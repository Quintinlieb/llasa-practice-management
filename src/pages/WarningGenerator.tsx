import { useState, useEffect, useMemo, useCallback, useRef, type ComponentType, type SVGProps } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, X, Info, RotateCcw, Building2, User2, Briefcase, Check, TriangleAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { warningGeneratorSchema } from "@/lib/validation";
import type { Tables } from "@/integrations/supabase/types";
import type { WarningGeneratorFormData } from "@/lib/validation";
import { cn } from "@/lib/utils";

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
];

type EmployeePrefillState = {
  employeeName?: string;
  employeeSurname?: string;
  employeeIdNumber?: string;
};

const isEmployeePrefillState = (value: unknown): value is EmployeePrefillState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["employeeName", "employeeSurname", "employeeIdNumber"].every((key) => {
    if (!(key in candidate)) return true;
    return typeof candidate[key] === "string";
  });
};

type WarningFormData = {
  clientId: string;
  companyName: string;
  registrationNumber: string;
  physicalAddress: string;
  employeeId: string;
  validityMonths: string;
  warningType: WarningGeneratorFormData["warningType"] | "";
} & Pick<
  WarningGeneratorFormData,
  | "tradingName"
  | "employerContact"
  | "employerEmail"
  | "employeeName"
  | "employeeSurname"
  | "employeeIdNumber"
  | "issuedBy"
  | "dateIssued"
  | "misconductTypes"
  | "description"
>;

type WarningClient = {
  id: string;
  registered_name: string | null;
  trading_as: string | null;
  registration_number: string | null;
  physical_address_line1: string | null;
  physical_address_line2: string | null;
  city: string | null;
  province: string | null;
  area_code: string | null;
  owner_number: string | null;
  primary_number: string | null;
  owner_email: string | null;
  primary_email: string | null;
};
type EmployeeWarningRow = {
  id: string;
  misconduct_type: string | null;
  warning_type: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  file_url: string | null;
};

const warningTable = () => (supabase as any).from("employee_warnings");
const dateToday = () => new Date().toISOString().split("T")[0];
const toDateOnly = (value: string) => value.split("T")[0];
const formatDisplayDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};
const normalizeMisconduct = (value?: string | null) => (value || "").trim().toLowerCase();
const coerceWarningType = (value?: string | null) => {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "" as WarningGeneratorFormData["warningType"] | "";
  if (normalized.includes("first")) return "first";
  if (normalized.includes("second")) return "second";
  if (normalized.includes("serious")) return "serious";
  if (normalized.includes("final")) return "final";
  return "" as WarningGeneratorFormData["warningType"] | "";
};
const parseStoredMisconductTypes = (value?: string | null): string[] => {
  const raw = (value || "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter((item) => item.trim().length > 0);
      }
    } catch {
      // Fall back to plain-string handling.
    }
  }
  return [raw];
};
const warningValidityMonths: Record<WarningGeneratorFormData["warningType"], number> = {
  first: 6,
  second: 6,
  serious: 9,
  final: 12,
};
const warningTypeLabels: Record<WarningGeneratorFormData["warningType"], string> = {
  first: "First Written Warning",
  second: "Second Written Warning",
  serious: "Serious Written Warning",
  final: "Final Written Warning",
};
const duplicateWarningRecommendations: Record<
  WarningGeneratorFormData["warningType"],
  WarningGeneratorFormData["warningType"] | null
> = {
  first: "second",
  second: "final",
  serious: "final",
  final: null,
};
const computeWarningExpiry = (
  warningType: WarningGeneratorFormData["warningType"] | "",
  issueDate: string | null,
) => {
  if (!warningType || !issueDate) return "";
  const months = warningValidityMonths[warningType] ?? 6;
  const base = new Date(issueDate);
  if (Number.isNaN(base.getTime())) return "";
  const expiry = new Date(base);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry.toISOString().split("T")[0];
};
const getWarningExpiryDate = (warning: EmployeeWarningRow) => {
  if (warning.expiry_date) return toDateOnly(warning.expiry_date);
  const coerced = coerceWarningType(warning.warning_type);
  return computeWarningExpiry(coerced, warning.issue_date);
};
const isWarningActive = (warning: EmployeeWarningRow) => {
  const expiry = getWarningExpiryDate(warning);
  if (!expiry) return false;
  return expiry >= dateToday();
};

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "errors" in error) {
    const parsed = error as { errors?: Array<{ message?: string }> };
    const message = parsed.errors?.[0]?.message;
    if (message) {
      return message;
    }
  }

  if (error instanceof Error) {
    return error.message || "Something went wrong. Please try again.";
  }

  return "Something went wrong. Please try again.";
};

const resolveRecommendedWarningType = (
  warningType: WarningGeneratorFormData["warningType"] | "",
  warning: EmployeeWarningRow,
) => {
  const selectedRecommendation = warningType ? duplicateWarningRecommendations[warningType] : null;
  if (selectedRecommendation) return selectedRecommendation;
  const existingType = coerceWarningType(warning.warning_type);
  if (existingType) return duplicateWarningRecommendations[existingType];
  return null;
};

const WarningGenerator = ({
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
    isFinished?: boolean;
  }) => void;
}) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<WarningClient[]>([]);
  const [employeeWarnings, setEmployeeWarnings] = useState<EmployeeWarningRow[]>([]);
  const [misconductSearch, setMisconductSearch] = useState("");
  const [misconductPickerOpen, setMisconductPickerOpen] = useState(false);
  const [draftMisconductTypes, setDraftMisconductTypes] = useState<string[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const clientSearchInputRef = useRef<HTMLInputElement | null>(null);
  const misconductSearchInputRef = useRef<HTMLInputElement | null>(null);
  const dateIssuedPickerRef = useRef<HTMLInputElement | null>(null);
  const [warningSelectResetCount, setWarningSelectResetCount] = useState(0);
  const [clientSelectResetCount, setClientSelectResetCount] = useState(0);
  const [conductOffences, setConductOffences] = useState<
    { category: "Minor" | "Serious" | "Dismissible"; name: string; firstOutcome: string }[]
  >([]);
  const [warningOverride, setWarningOverride] = useState<{
    open: boolean;
    message: string;
    next: WarningGeneratorFormData["warningType"] | "";
  }>({ open: false, message: "", next: "" });
  const [duplicateWarningOverride, setDuplicateWarningOverride] = useState<{
    open: boolean;
    messageIntro: string;
    messagePrompt: string;
    pendingWarningType: WarningGeneratorFormData["warningType"] | "";
    pendingMisconduct: string | null;
    pendingAction: "" | "finish" | "submit";
    viewUrl: string | null;
  }>({
    open: false,
    messageIntro: "",
    messagePrompt: "",
    pendingWarningType: "",
    pendingMisconduct: null,
    pendingAction: "",
    viewUrl: null,
  });
  const [warningSelectOpen, setWarningSelectOpen] = useState(false);
  const [dismissibleOverride, setDismissibleOverride] = useState<{
    open: boolean;
    pending: string | null;
    target: "form" | "draft";
  }>({ open: false, pending: null, target: "form" });
  const [mixedCategoryCaution, setMixedCategoryCaution] = useState<{
    open: boolean;
    existingMisconduct: string;
    existingCategory: "Minor" | "Serious" | "Dismissible" | null;
    attemptedMisconduct: string;
    attemptedCategory: "Minor" | "Serious" | "Dismissible" | null;
  }>({
    open: false,
    existingMisconduct: "",
    existingCategory: null,
    attemptedMisconduct: "",
    attemptedCategory: null,
  });
  const [duplicateOverrideAccepted, setDuplicateOverrideAccepted] = useState(false);
  const [formData, setFormData] = useState<WarningFormData>({
    clientId: "",
    companyName: "",
    registrationNumber: "",
    physicalAddress: "",
    tradingName: "",
    employerContact: "",
    employerEmail: "",
    employeeId: "",
    employeeName: "",
    employeeSurname: "",
    employeeIdNumber: "",
    warningType: "" as WarningGeneratorFormData["warningType"] | "",
    validityMonths: "",
    issuedBy: "",
    dateIssued: new Date().toISOString().split("T")[0],
    misconductTypes: [] as string[],
    description: "",
  });
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const steps = ["Client Details", "Employee Details", "Warning Details"] as const;
  const stepIcons = [Building2, User2, TriangleAlert] as const;
  const [activeStep, setActiveStep] = useState(0);
  const [showFinalActions, setShowFinalActions] = useState(false);
  const baseModalFieldClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-[#3eca44] !focus-visible:border-[1.75px] !focus-visible:border-[#3eca44] focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default";
  const warningModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-[#3eca44] data-[state=open]:border-slate-300 data-[state=open]:bg-white";
  const warningModalSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700";
  const getWarningModalInputClass = (isComplete: boolean) =>
    `${baseModalFieldClass} !h-[34px] !border-[1.75px] !border-slate-300 !focus-visible:border-slate-300 ${isComplete ? "!border-emerald-500" : ""}`;
  const getWarningModalSelectTriggerClass = (isComplete: boolean) =>
    `${baseModalFieldClass} justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs !h-[34px] !border-[1.75px] !border-slate-300 !focus:border-[#3eca44] !focus-visible:border-[#3eca44] data-[state=open]:!border-[#3eca44] !ring-0 !ring-offset-0 !outline-none !shadow-none !focus:ring-0 !focus:ring-offset-0 !focus:shadow-none !focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:shadow-none !focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none ${isComplete ? "!border-emerald-500" : ""}`;
  const modalFieldLabelClass = "text-[10px] font-semibold text-slate-400";

  useEffect(() => {
    if (isEmployeePrefillState(location.state)) {
      const { employeeName, employeeSurname, employeeIdNumber } = location.state;
      if (employeeName || employeeSurname || employeeIdNumber) {
        setFormData((prev) => ({
          ...prev,
          employeeName: employeeName || "",
          employeeSurname: employeeSurname || "",
          employeeIdNumber: employeeIdNumber || "",
        }));
      }
    }
  }, [location.state]);

  const fetchClients = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("clients")
      .select(
        "id,registered_name,trading_as,registration_number,physical_address_line1,physical_address_line2,city,province,area_code,owner_number,primary_number,owner_email,primary_email",
      )
      .order("registered_name", { ascending: true, nullsFirst: false });
    if (data) {
      setClients(data as WarningClient[]);
    }
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
      fetchClients();
      fetchConductOffences();
    }
  }, [user, fetchClients, fetchConductOffences]);

  const fetchEmployeeWarnings = useCallback(
    async (employeeId: string) => {
      if (!user || !employeeId) {
        setEmployeeWarnings([]);
        return;
      }
      const { data, error } = await warningTable()
        .select("id, misconduct_type, warning_type, issue_date, expiry_date, file_url")
        .eq("company_id", user.id)
        .eq("employee_id", employeeId);

      if (error) {
        console.warn("Unable to load employee warnings", error);
        setEmployeeWarnings([]);
        return;
      }

      setEmployeeWarnings((data as EmployeeWarningRow[]) ?? []);
    },
    [user],
  );

  useEffect(() => {
    if (!formData.employeeId) {
      setEmployeeWarnings([]);
      return;
    }
    fetchEmployeeWarnings(formData.employeeId);
  }, [formData.employeeId, fetchEmployeeWarnings]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        String(a.registered_name || "").localeCompare(String(b.registered_name || ""), undefined, {
          sensitivity: "base",
        }),
      ),
    [clients],
  );
  const searchedClients = useMemo(() => {
    const query = clientSearchQuery.trim().toLowerCase().replace(/\s+/g, " ");
    if (!query) return sortedClients;
    const tokens = query.split(" ").filter(Boolean);
    return sortedClients
      .map((client) => {
        const name = String(client.registered_name || "").trim();
        const trading = String(client.trading_as || "").trim();
        const searchable = `${name} ${trading}`.trim().replace(/\s+/g, " ").toLowerCase();
        let score = 0;
        if (searchable === query) score += 1000;
        if (searchable.startsWith(query)) score += 800;
        if (searchable.includes(query)) score += 500;
        if (tokens.length > 0 && tokens.every((token) => searchable.includes(token))) score += 300;
        return { client, score, searchable };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.searchable.localeCompare(b.searchable, undefined, { sensitivity: "base" }))
      .map((item) => item.client);
  }, [clientSearchQuery, sortedClients]);


  useEffect(() => {
    setDuplicateOverrideAccepted(false);
  }, [formData.employeeId, formData.misconductTypes.join("|"), formData.warningType]);

  const misconductOptions = useMemo(() => {
    if (conductOffences.length > 0) return conductOffences;
    return MISCONDUCT_TYPES.map((name) => ({ name, category: "Serious" as const, firstOutcome: "" }));
  }, [conductOffences]);

  const misconductColorClasses = (category: "Minor" | "Serious" | "Dismissible") => {
    if (category === "Minor") return "text-emerald-700";
    if (category === "Serious") return "text-amber-700";
    return "text-red-700";
  };

  const getMisconductCategory = (name: string): "Minor" | "Serious" | "Dismissible" => {
    const found = conductOffences.find((item) => item.name === name);
    return found?.category ?? "Serious";
  };

  const filteredMisconductTypes = useMemo(() => {
    const query = misconductSearch.trim().toLowerCase();
    if (!query) return misconductOptions;
    return misconductOptions.filter((type) => type.name.toLowerCase().includes(query));
  }, [misconductSearch, misconductOptions]);

  const outcomeSeverity = (outcome: string): number => {
    const value = outcome.toLowerCase();
    if (value.includes("dismiss")) return 5;
    if (value.includes("final")) return 4;
    if (value.includes("serious")) return 3;
    if (value.includes("second")) return 2;
    if (value.includes("first")) return 1;
    return 0;
  };

  const severityFromWarningType = (value: WarningGeneratorFormData["warningType"] | ""): number => {
    switch (value) {
      case "first":
        return 1;
      case "second":
        return 2;
      case "serious":
        return 3;
      case "final":
        return 4;
      default:
        return 0;
    }
  };

  const getSelectionRequirement = (selectedTypes: string[]) => {
    const evaluated = selectedTypes.map((type) => {
      const offence = conductOffences.find((item) => item.name === type);
      const severity = offence ? outcomeSeverity(offence.firstOutcome) : 0;
      return { type, severity, outcome: offence?.firstOutcome ?? "", matched: Boolean(offence) };
    });
    const matchedCount = evaluated.filter((item) => item.matched).length;
    const matches = evaluated.filter((item) => item.severity > 0);

    if (matches.length === 0) return { requirement: null, matchedCount };
    const requirement = matches.reduce((prev, curr) => (curr.severity > prev.severity ? curr : prev), matches[0]);
    return { requirement, matchedCount };
  };

  const applyWarningType = (value: WarningGeneratorFormData["warningType"] | "") => {
    const validityMap: Record<WarningGeneratorFormData["warningType"], string> = {
      first: "6",
      second: "6",
      serious: "9",
      final: "12",
    };
    if (!value) {
      setFormData((prev) => ({ ...prev, warningType: "", validityMonths: "" }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      warningType: value,
      validityMonths: validityMap[value] || "",
    }));
  };

  const resetWarningSelection = () => {
    setFormData((prev) => ({ ...prev, warningType: "", validityMonths: "" }));
    setWarningSelectResetCount((prev) => prev + 1);
  };

  const confirmOverrideWarning = (accepted: boolean) => {
    if (accepted && warningOverride.next) {
      applyWarningTypeWithDuplicateCheck(warningOverride.next);
    } else {
      resetWarningSelection();
    }
    setWarningOverride({ open: false, message: "", next: "" });
    setWarningSelectOpen(false);
  };

  const buildDuplicateWarningMessageParts = (
    warningType: WarningGeneratorFormData["warningType"] | "",
    misconduct: string,
    warning: EmployeeWarningRow,
  ) => {
    const existingWarningType = coerceWarningType(warning.warning_type);
    const existingLabel = existingWarningType ? warningTypeLabels[existingWarningType] : "Warning";
    const selectedLabel = warningType ? warningTypeLabels[warningType] : "Warning";
    const expiryDate = getWarningExpiryDate(warning);
    const expiryDisplay = expiryDate ? formatDisplayDate(expiryDate) : "--";
    const recommendedType = resolveRecommendedWarningType("", warning);
    const recommendedLabel = recommendedType ? warningTypeLabels[recommendedType] : "";
    return {
      intro: `The employee already has a valid ${existingLabel} for "${misconduct}" which expires on ${expiryDisplay}.`,
      prompt: recommendedType
        ? `Recommendation: ${recommendedLabel} for "${misconduct}".\n\nDo you want to override and continue with ${selectedLabel} instead?`
        : `No higher warning type is available for "${misconduct}".\n\nDo you want to override and continue with ${selectedLabel}?`,
    };
  };

  const findDuplicateWarning = (
    misconductTypes: string[],
    warningType: WarningGeneratorFormData["warningType"] | "",
  ) => {
    if (!formData.employeeId || !warningType || employeeWarnings.length === 0) return null;
    const selectedWarningType = coerceWarningType(warningType);
    if (!selectedWarningType) return null;
    const activeWarnings = employeeWarnings.filter(isWarningActive);

    for (const misconduct of misconductTypes) {
      const normalizedMisconduct = normalizeMisconduct(misconduct);
      const matchingWarnings = activeWarnings.filter((warning) => {
        const storedMisconductTypes = parseStoredMisconductTypes(warning.misconduct_type).map(normalizeMisconduct);
        return storedMisconductTypes.includes(normalizedMisconduct);
      });

      if (matchingWarnings.length === 0) continue;

      const mostSevereMatch = matchingWarnings.reduce((current, candidate) => {
        const currentType = coerceWarningType(current.warning_type);
        const candidateType = coerceWarningType(candidate.warning_type);
        if (!candidateType) return current;
        if (!currentType) return candidate;
        return severityFromWarningType(candidateType) > severityFromWarningType(currentType) ? candidate : current;
      });
      const existingType = coerceWarningType(mostSevereMatch.warning_type);
      if (!existingType) continue;

      const recommendedType = duplicateWarningRecommendations[existingType];
      const isSelectedRecommended = recommendedType ? selectedWarningType === recommendedType : false;

      if (!isSelectedRecommended) {
        return { warning: mostSevereMatch, misconduct };
      }
    }
    return null;
  };

  const openDuplicateWarningOverride = (params: {
    messageIntro: string;
    messagePrompt: string;
    pendingWarningType?: WarningGeneratorFormData["warningType"] | "";
    pendingMisconduct?: string | null;
    pendingAction?: "" | "finish" | "submit";
    viewUrl?: string | null;
  }) => {
    setWarningSelectOpen(false);
    setDuplicateWarningOverride({
      open: true,
      messageIntro: params.messageIntro,
      messagePrompt: params.messagePrompt,
      pendingWarningType: params.pendingWarningType || "",
      pendingMisconduct: params.pendingMisconduct ?? null,
      pendingAction: params.pendingAction || "",
      viewUrl: params.viewUrl ?? null,
    });
  };

  const confirmDuplicateWarningOverride = (accepted: boolean) => {
    if (accepted) {
      setDuplicateOverrideAccepted(true);
      if (duplicateWarningOverride.pendingWarningType) {
        applyWarningType(duplicateWarningOverride.pendingWarningType);
      } else if (duplicateWarningOverride.pendingMisconduct) {
        updateMisconductTypes((prev) => {
          if (prev.includes(duplicateWarningOverride.pendingMisconduct!)) return prev;
          return [...prev, duplicateWarningOverride.pendingMisconduct!];
        });
      } else if (duplicateWarningOverride.pendingAction === "finish") {
        setShowFinalActions(true);
      } else if (duplicateWarningOverride.pendingAction === "submit") {
        performSubmit();
      }
    } else if (duplicateWarningOverride.pendingWarningType) {
      resetWarningSelection();
    }
    setDuplicateWarningOverride({
      open: false,
      messageIntro: "",
      messagePrompt: "",
      pendingWarningType: "",
      pendingMisconduct: null,
      pendingAction: "",
      viewUrl: null,
    });
  };

  const applyWarningTypeWithDuplicateCheck = (value: WarningGeneratorFormData["warningType"]) => {
    if (!duplicateOverrideAccepted) {
      const duplicate = findDuplicateWarning(formData.misconductTypes, value);
      if (duplicate) {
        const { intro, prompt } = buildDuplicateWarningMessageParts(value, duplicate.misconduct, duplicate.warning);
        openDuplicateWarningOverride({
          messageIntro: intro,
          messagePrompt: prompt,
          pendingWarningType: value,
          viewUrl: duplicate.warning.file_url,
        });
        return;
      }
    }
    applyWarningType(value);
  };

  const updateMisconductTypes = (updater: (prev: string[]) => string[]) => {
    setFormData((prev) => {
      const next = updater(prev.misconductTypes);
      const shouldResetWarning = next.length === 0;
      return {
        ...prev,
        misconductTypes: next,
        warningType: shouldResetWarning ? "" : prev.warningType,
        validityMonths: shouldResetWarning ? "" : prev.validityMonths,
      };
    });
  };

  const handleConfirmDismissible = (accept: boolean) => {
    if (accept && dismissibleOverride.pending) {
      if (dismissibleOverride.target === "draft") {
        setDraftMisconductTypes((prev) => {
          if (prev.includes(dismissibleOverride.pending!)) return prev;
          return [...prev, dismissibleOverride.pending!];
        });
      } else {
        updateMisconductTypes((prev) => {
          if (prev.includes(dismissibleOverride.pending!)) return prev;
          return [...prev, dismissibleOverride.pending!];
        });
      }
    }
    setDismissibleOverride({ open: false, pending: null, target: "form" });
  };

  const closeMixedCategoryCaution = () => {
    setMixedCategoryCaution({
      open: false,
      existingMisconduct: "",
      existingCategory: null,
      attemptedMisconduct: "",
      attemptedCategory: null,
    });
  };

  useEffect(() => {
    if (!clientSearchOpen) return;
    const timer = setTimeout(() => clientSearchInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [clientSearchOpen]);

  useEffect(() => {
    if (!misconductPickerOpen) return;
    setDraftMisconductTypes(formData.misconductTypes);
    const timer = setTimeout(() => misconductSearchInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [misconductPickerOpen, formData.misconductTypes]);

  const handleDraftMisconductSelect = (type: string) => {
    const isSelected = draftMisconductTypes.includes(type);
    if (isSelected) {
      setDraftMisconductTypes((prev) => prev.filter((item) => item !== type));
      return;
    }

    const newCategory = getMisconductCategory(type);
    const currentCategory = draftMisconductTypes.length > 0 ? getMisconductCategory(draftMisconductTypes[0]) : null;
    if (newCategory === "Dismissible") {
      setDismissibleOverride({ open: true, pending: type, target: "draft" });
      return;
    }
    if (currentCategory && newCategory !== currentCategory) {
      setMixedCategoryCaution({
        open: true,
        existingMisconduct: draftMisconductTypes[0] ?? "",
        existingCategory: currentCategory,
        attemptedMisconduct: type,
        attemptedCategory: newCategory,
      });
      return;
    }

    setDraftMisconductTypes((prev) => [...prev, type]);
  };

  const openMisconductPicker = () => {
    setMisconductSearch("");
    setMisconductPickerOpen(true);
  };

  const cancelMisconductPicker = () => {
    setMisconductPickerOpen(false);
    setMisconductSearch("");
    setDraftMisconductTypes(formData.misconductTypes);
  };

  const applyMisconductPicker = () => {
    updateMisconductTypes(() => draftMisconductTypes);
    setMisconductPickerOpen(false);
    setMisconductSearch("");
  };

  const handleWarningSelectOpenChange = (open: boolean) => {
    if (open && formData.misconductTypes.length === 0) {
      toast({
        title: "Misconduct required",
        description: "Please select misconduct type(s) before choosing a warning type.",
        variant: "destructive",
      });
      setWarningSelectOpen(false);
      return;
    }
    setWarningSelectOpen(open);
  };

  const pulseShadowStyles = `
    @keyframes pulseShadow {
      0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45); }
      70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
      100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
    }
    @keyframes pulseText {
      0% { text-shadow: 0 0 0 rgba(220, 38, 38, 0.6); }
      50% { text-shadow: 0 0 12px rgba(220, 38, 38, 0.6); }
      100% { text-shadow: 0 0 0 rgba(220, 38, 38, 0.6); }
    }
  `;

  const handleWarningTypeChange = (value: WarningGeneratorFormData["warningType"]) => {
    const { requirement: selectionRequirement, matchedCount } = getSelectionRequirement(formData.misconductTypes);
    const newSeverity = severityFromWarningType(value);
    const selectedWarningLabel = warningTypeLabels[value] || value;

    if (formData.misconductTypes.length > 0 && (conductOffences.length === 0 || matchedCount === 0)) {
      resetWarningSelection();
      setWarningSelectOpen(false);
      setWarningOverride({
        open: true,
        message: `No Code of Conduct warning was found for the selected misconduct. Override the Code of Conduct and use "${selectedWarningLabel}" instead?`,
        next: value,
      });
      return;
    }

    if (selectionRequirement && newSeverity > 0 && selectionRequirement.severity !== newSeverity) {
      const prescribed = selectionRequirement.outcome || "a different warning";
      resetWarningSelection();
      setWarningSelectOpen(false);
      setWarningOverride({
        open: true,
        message: `The Code of Conduct prescribes a "${prescribed}" for ${selectionRequirement.type}. Are you sure you want to override the Code of Conduct and use "${selectedWarningLabel}" instead?`,
        next: value,
      });
      return;
    }

    applyWarningTypeWithDuplicateCheck(value);
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const address = [
      client.physical_address_line1,
      client.physical_address_line2,
      client.city,
      client.province,
      client.area_code,
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(", ");
    setFormData((prev) => ({
      ...prev,
      clientId,
      companyName: String(client.registered_name || "").trim(),
      registrationNumber: String(client.registration_number || "").trim(),
      physicalAddress: address,
      tradingName: String(client.trading_as || "").trim(),
      employerContact: String(client.owner_number || client.primary_number || "").trim(),
      employerEmail: String(client.owner_email || client.primary_email || "").trim(),
    }));
    setClientSearchOpen(false);
    setClientSearchQuery("");
    setClientSelectResetCount((prev) => prev + 1);
  };
  const handleOpenWarningFile = useCallback((fileUrl: string | null) => {
    if (!fileUrl) return;
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  }, []);
  const openDateIssuedPicker = useCallback(() => {
    const picker = dateIssuedPickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
      return;
    }
    picker.focus();
    picker.click();
  }, []);

  const generatePDF = (download = false) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = 15;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("DISCIPLINARY WARNING NOTICE", pageWidth / 2, yPosition, { align: "center" });
    
    yPosition += 10;

        // Company Details Section
    const labelWidth = 40; // bring value column closer to labels
    const lineHeight = 5;
    const drawSectionTitle = (label: string) => {
      const sectionHeight = 8;
      doc.setFillColor(240, 240, 240);
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(margin, yPosition, contentWidth, sectionHeight, 2, 2, "FD");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      const headerCenterY = yPosition + sectionHeight / 2;
      doc.text(label, margin + 4, headerCenterY, { baseline: "middle" });
      yPosition += sectionHeight + 6;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
    };

    const renderLabelValue = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, margin, yPosition);
      doc.setFont("helvetica", "normal");
      const text = value || "-";
      const lines = doc.splitTextToSize(text, contentWidth - labelWidth - 4);
      doc.text(lines, margin + labelWidth, yPosition);
      yPosition += Math.max(lines.length * lineHeight, lineHeight);
    };

    const formatDateForPdf = (value: string) => {
      if (!value) return "-";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return value;
      return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    drawSectionTitle("A. EMPLOYER DETAILS");
    const employerDisplayName = formData.tradingName
      ? `${formData.companyName || "-"} t/a ${formData.tradingName}`
      : formData.companyName || "-";
    renderLabelValue("Company Name:", employerDisplayName);
    renderLabelValue("Registration No:", formData.registrationNumber || "-");
    renderLabelValue("Employer Number:", formData.employerContact || "-");
    renderLabelValue("Employer Email:", formData.employerEmail || "-");
    renderLabelValue("Employer Address:", formData.physicalAddress || "-");
    yPosition += 4;

    drawSectionTitle("B. EMPLOYEE DETAILS");
    renderLabelValue("Employee Name:", `${formData.employeeName} ${formData.employeeSurname}`.trim() || "-");
    renderLabelValue("ID Number:", formData.employeeIdNumber || "-");
    yPosition += 4;

    const warningTypeText = {
      first: "First Written Warning",
      second: "Second Written Warning",
      serious: "Serious Written Warning",
      final: "Final Written Warning",
    }[formData.warningType] || formData.warningType || "-";

    drawSectionTitle("C. WARNING DETAILS");
    const offenceText = formData.misconductTypes.length > 0 ? formData.misconductTypes.join(", ") : "-";
    renderLabelValue("Offence(s):", offenceText);
    renderLabelValue("Description:", formData.description || "-");
    renderLabelValue("Warning Type:", warningTypeText);
    renderLabelValue("Validity Period:", formData.validityMonths ? `${formData.validityMonths} months` : "-");
    renderLabelValue("Issued By:", formData.issuedBy || "-");
    renderLabelValue("Issue Date:", formatDateForPdf(formData.dateIssued));
    yPosition += 4;

    drawSectionTitle("D. CONSEQUENCES");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const consequencesText =
      "You are required to refrain completely from committing any further acts of misconduct. Should you commit the same or similar act of misconduct within the validity period of this warning, progressive disciplinary action will be taken which could lead to your dismissal.";
    const consequencesLines = doc.splitTextToSize(consequencesText, contentWidth);
    doc.text(consequencesLines, margin, yPosition);
    yPosition += consequencesLines.length * 4.5 + 4;

    drawSectionTitle("E. SIGNATURES");
    yPosition += 6; // add space above first signature line
    
    const signaturePairs: [string, string][] = [
      ["Employer/Issuer", "Employee"],
      ["Representative", "Interpreter"],
      ["Witness 1 (optional)", "Witness 2 (optional)"],
    ];
    const colGap = 20; // smaller gap to bring the right column left
    const colWidth = (contentWidth - colGap) / 2;
    const rowHeight = 18;
    const sigLineLength = 39; // reduced ~40%
    const dateLineLength = 22; // reduced further
    const lineOffset = 0;

    const drawSignatureBlock = (label: string, x: number, y: number) => {
      const dateX = x + sigLineLength + 12;
      doc.setDrawColor(170, 170, 170); // lighter grey lines
      doc.line(x, y, x + sigLineLength, y);
      doc.line(dateX, y, dateX + dateLineLength, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0); // labels in black
      doc.text(label, x, y + lineOffset + 3);
      doc.text("Date", dateX, y + lineOffset + 3);
    };

    signaturePairs.forEach((pair, row) => {
      const yRow = yPosition + row * rowHeight;
      drawSignatureBlock(pair[0], margin, yRow);
      drawSignatureBlock(pair[1], margin + colWidth + colGap, yRow);
    });

    yPosition += signaturePairs.length * rowHeight - 4; // tighten spacing before refusal box
    const footerText =
      "If the employee refuses to sign this warning, the witness's signature will confirm that the employee did receive the warning and that the contents were explained to him/her.";
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(70, 74, 78);
    const footerPaddingX = 4;
    const footerPaddingY = 2;
    const footerLines = doc.splitTextToSize(footerText, contentWidth - footerPaddingX * 2);
    const footerBoxHeight = footerLines.length * 4 + footerPaddingY * 2;
    doc.setFillColor(247, 249, 251);
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin, yPosition, contentWidth, footerBoxHeight, 2, 2, "FD");
    doc.text(footerLines, margin + footerPaddingX, yPosition + footerPaddingY + 3);

    if (download) {
      doc.save(`Warning_${formData.employeeSurname}_${formData.dateIssued}.pdf`);
    } else {
      const blob = doc.output("blob");
      setPdfBlob(blob);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  };

  const performSubmit = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Validate and sanitize input
      const validatedData = warningGeneratorSchema.parse({
        tradingName: formData.tradingName,
        employerContact: formData.employerContact,
        employerEmail: formData.employerEmail,
        employeeName: formData.employeeName,
        employeeSurname: formData.employeeSurname,
        employeeIdNumber: formData.employeeIdNumber,
        warningType: formData.warningType,
        validityMonths: formData.validityMonths,
        issuedBy: formData.issuedBy,
        dateIssued: formData.dateIssued,
        misconductTypes: formData.misconductTypes,
        description: formData.description,
      });

      const { error } = await supabase.from("documents").insert({
        company_id: user.id,
        employee_id: formData.employeeId || null,
        trading_name: validatedData.tradingName,
        employee_name: validatedData.employeeName,
        employee_surname: validatedData.employeeSurname,
        employee_id_number: validatedData.employeeIdNumber,
        warning_type: validatedData.warningType,
        validity_months: validatedData.validityMonths,
        issued_by: validatedData.issuedBy,
        date_issued: validatedData.dateIssued,
        misconduct: validatedData.misconductTypes.join(", "),
        description: validatedData.description,
        dates_committed: "",
      });

      if (error) throw error;

      generatePDF(true);

      toast({
        title: "Success",
        description: "Warning document generated and saved!",
      });

      handleResetForm();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: extractErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!duplicateOverrideAccepted) {
      const duplicate = findDuplicateWarning(formData.misconductTypes, formData.warningType);
      if (duplicate) {
        const { intro, prompt } = buildDuplicateWarningMessageParts(
          formData.warningType,
          duplicate.misconduct,
          duplicate.warning,
        );
        openDuplicateWarningOverride({
          messageIntro: intro,
          messagePrompt: prompt,
          pendingAction: "submit",
          viewUrl: duplicate.warning.file_url,
        });
        return;
      }
    }

    await performSubmit();
  };

  const handleDownload = () => {
    if (formData.misconductTypes.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one misconduct type",
        variant: "destructive",
      });
      return;
    }
    generatePDF(true);
  };

  const handleResetForm = () => {
    setFormData({
      clientId: "",
      companyName: "",
      registrationNumber: "",
      physicalAddress: "",
      tradingName: "",
      employerContact: "",
      employerEmail: "",
      employeeId: "",
      employeeName: "",
      employeeSurname: "",
      employeeIdNumber: "",
      warningType: "" as WarningGeneratorFormData["warningType"] | "",
      validityMonths: "",
      issuedBy: "",
      dateIssued: new Date().toISOString().split("T")[0],
      misconductTypes: [],
      description: "",
    });
    setPdfBlob(null);
    setWarningSelectOpen(false);
    setMisconductPickerOpen(false);
    setDraftMisconductTypes([]);
    setMisconductSearch("");
    setClientSelectResetCount((prev) => prev + 1);
    setClientSearchOpen(false);
    setClientSearchQuery("");
    setActiveStep(0);
    setShowFinalActions(false);
    resetWarningSelection();
    setEmployeeWarnings([]);
    setDuplicateOverrideAccepted(false);
    setDuplicateWarningOverride({
      open: false,
      messageIntro: "",
      messagePrompt: "",
      pendingWarningType: "",
      pendingMisconduct: null,
      pendingAction: "",
      viewUrl: null,
    });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleResetWarningStep = () => {
    setFormData((prev) => ({
      ...prev,
      warningType: "" as WarningGeneratorFormData["warningType"] | "",
      validityMonths: "",
      issuedBy: "",
      dateIssued: new Date().toISOString().split("T")[0],
      misconductTypes: [],
      description: "",
    }));
    setWarningSelectOpen(false);
    setMisconductPickerOpen(false);
    setDraftMisconductTypes([]);
    setMisconductSearch("");
    setShowFinalActions(false);
    resetWarningSelection();
    setDuplicateOverrideAccepted(false);
    setDuplicateWarningOverride({
      open: false,
      messageIntro: "",
      messagePrompt: "",
      pendingWarningType: "",
      pendingMisconduct: null,
      pendingAction: "",
      viewUrl: null,
    });
  };

  const handleResetClientStep = () => {
    setFormData((prev) => ({
      ...prev,
      clientId: "",
      companyName: "",
      registrationNumber: "",
      physicalAddress: "",
      tradingName: "",
      employerContact: "",
      employerEmail: "",
    }));
    setClientSelectResetCount((prev) => prev + 1);
    setClientSearchOpen(false);
    setClientSearchQuery("");
  };

  const handleResetEmployeeStep = () => {
    setFormData((prev) => ({
      ...prev,
      employeeId: "",
      employeeName: "",
      employeeSurname: "",
      employeeIdNumber: "",
    }));
  };
  const clearCurrentStepFields = () => {
    if (activeStep === 0) {
      handleResetClientStep();
      return;
    }
    if (activeStep === 1) {
      handleResetEmployeeStep();
      return;
    }
    if (activeStep === 2) {
      handleResetWarningStep();
    }
  };

  const isFormValid = () => {
    return (
      formData.misconductTypes.length > 0 &&
      formData.employerContact &&
      formData.employerEmail &&
      formData.description &&
      formData.employeeName &&
      formData.employeeSurname &&
      formData.employeeIdNumber &&
      formData.warningType &&
      formData.issuedBy
    );
  };

  const isEmployerStepComplete = useMemo(
    () => Boolean(formData.employerContact && formData.employerEmail),
    [formData.employerContact, formData.employerEmail],
  );
  const isEmployeeStepComplete = useMemo(
    () => Boolean(formData.employeeName && formData.employeeSurname && formData.employeeIdNumber),
    [formData.employeeIdNumber, formData.employeeName, formData.employeeSurname],
  );
  const isWarningStepComplete = useMemo(
    () =>
      Boolean(
        formData.misconductTypes.length > 0 &&
          formData.description &&
          formData.employeeName &&
          formData.employeeSurname &&
          formData.employeeIdNumber &&
          formData.warningType &&
          formData.issuedBy,
      ),
    [
      formData.description,
      formData.employeeIdNumber,
      formData.employeeName,
      formData.employeeSurname,
      formData.issuedBy,
      formData.misconductTypes.length,
      formData.warningType,
    ],
  );
  const activeWarnings = useMemo(() => employeeWarnings.filter(isWarningActive), [employeeWarnings]);

  const canGoNext = useMemo(() => {
    if (showFinalActions) return false;
    if (activeStep === 0) return isEmployerStepComplete;
    if (activeStep === 1) return isEmployeeStepComplete;
    if (activeStep === 2) return isWarningStepComplete;
    return false;
  }, [activeStep, isEmployeeStepComplete, isEmployerStepComplete, isWarningStepComplete, showFinalActions]);

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
    if (activeStep >= steps.length - 1) return;
    if (!canGoNext) return;
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const canAdvance = activeStep === steps.length - 1 ? isWarningStepComplete : canGoNext;

  const handleNextOrFinish = () => {
    if (showFinalActions) {
      handleDownload();
      return;
    }
    if (activeStep === steps.length - 1) {
      if (isWarningStepComplete) {
        handleFinish();
      }
      return;
    }
    handleNext();
  };

  const handleBack = () => {
    if (showFinalActions) {
      setShowFinalActions(false);
      setActiveStep(steps.length - 1);
      return;
    }
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  useEffect(() => {
    if (!embedded) return;
    onStepMetaChange?.({
      steps,
      activeStep,
      icons: stepIcons,
      canGoNext: canAdvance,
      canGoBack: showFinalActions || activeStep > 0,
      canSelectStep,
      onNext: handleNextOrFinish,
      onBack: handleBack,
      onStepSelect: handleStepSelect,
      onClear: clearCurrentStepFields,
      isFinished: showFinalActions,
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
    handleStepSelect,
    clearCurrentStepFields,
    isWarningStepComplete,
    showFinalActions,
  ]);

  const handleFinish = () => {
    if (!isFormValid()) {
      toast({
        title: "Validation Error",
        description: "Please complete all required fields before finishing.",
        variant: "destructive",
      });
      return;
    }
    if (!duplicateOverrideAccepted) {
      const duplicate = findDuplicateWarning(formData.misconductTypes, formData.warningType);
      if (duplicate) {
        const { intro, prompt } = buildDuplicateWarningMessageParts(
          formData.warningType,
          duplicate.misconduct,
          duplicate.warning,
        );
        openDuplicateWarningOverride({
          messageIntro: intro,
          messagePrompt: prompt,
          pendingAction: "finish",
          viewUrl: duplicate.warning.file_url,
        });
        return;
      }
    }
    setShowFinalActions(true);
  };

  const toggleMisconductType = (type: string) => {
    updateMisconductTypes((prev) => prev.filter((t) => t !== type));
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center", embedded ? "min-h-[60vh]" : "min-h-screen")}>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const warningSelectKey = `${formData.misconductTypes.join("|") || "empty"}-${formData.warningType || "none"}-${warningSelectResetCount}`;
  const isFinalizedCurrent = showFinalActions && activeStep === steps.length - 1;
  const useExternalShell = embedded && externalNavigation;
  const renderPreviewPage = () => (
    <div className="bg-white text-black px-8 pt-2 pb-8 mx-auto" style={{ width: "210mm", minHeight: "297mm" }}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-black">DISCIPLINARY WARNING NOTICE</h1>
      </div>

      <div className="space-y-5 text-sm text-black">
        {/* Employer Details */}
        <div className="space-y-2">
          <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            A. Employer Details
          </div>
          <div className="text-xs space-y-1">
            {(() => {
              const employerDisplayName = formData.tradingName
                ? `${formData.companyName || "-"} t/a ${formData.tradingName}`
                : formData.companyName || "-";
              return (
                <div className="grid grid-cols-[140px,1fr] gap-2">
                  <span className="font-semibold">Company Name:</span>
                  <span>{employerDisplayName}</span>
                </div>
              );
            })()}
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Registration No:</span>
              <span>{formData.registrationNumber || "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Employer Number:</span>
              <span>{formData.employerContact || "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Employer Email:</span>
              <span>{formData.employerEmail || "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Employer Address:</span>
              <span>{formData.physicalAddress || "-"}</span>
            </div>
          </div>
        </div>

        {/* Employee Details */}
        <div className="space-y-2">
          <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            B. Employee Details
          </div>
          <div className="text-xs space-y-1">
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Employee Name:</span>
              <span>
                {formData.employeeName} {formData.employeeSurname}
              </span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">ID Number:</span>
              <span>{formData.employeeIdNumber}</span>
            </div>
          </div>
        </div>

        {/* Warning Details */}
        <div className="space-y-2">
          <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            C. Warning Details
          </div>
          <div className="text-xs space-y-2">
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Offence(s):</span>
              <span>{formData.misconductTypes.length > 0 ? formData.misconductTypes.join(", ") : "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Description:</span>
              <span className="whitespace-pre-wrap">{formData.description || "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Warning Type:</span>
              <span>
                {{
                  first: "First Written Warning",
                  second: "Second Written Warning",
                  serious: "Serious Written Warning",
                  final: "Final Written Warning",
                }[formData.warningType] || formData.warningType || "-"}
              </span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Validity Period:</span>
              <span>{formData.validityMonths ? `${formData.validityMonths} months` : "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Issued By:</span>
              <span>{formData.issuedBy || "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Issue Date:</span>
              <span>
                {(() => {
                  if (!formData.dateIssued) return "-";
                  const parsed = new Date(formData.dateIssued);
                  if (Number.isNaN(parsed.getTime())) return formData.dateIssued;
                  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Consequences */}
        <div className="space-y-2">
          <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            D. Consequences
          </div>
          <p className="text-xs leading-5">
            You are required to refrain completely from committing any further acts of misconduct. Should you commit the same or similar act of misconduct within the validity period of this warning, progressive disciplinary action will be taken which could lead to your dismissal.
          </p>
        </div>

        {/* Signatures */}
        <div className="space-y-6">
          <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            E. Signatures
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-xs mt-4">
            {[
              "Employer/Issuer",
              "Employee",
              "Representative",
              "Interpreter",
              "Witness 1 (optional)",
              "Witness 2 (optional)",
            ].map((label, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-8">
                  <span className="flex-1 border-b border-black"></span>
                  <span className="w-24 border-b border-black"></span>
                </div>
                <div className="flex items-center gap-8 text-[11px]">
                  <span className="flex-1">{label}</span>
                  <span className="w-24">Date</span>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-[10px] italic text-gray-700">
            If the employee refuses to sign this warning, the witness's signature will confirm that the employee did receive the warning and that the contents were explained to him/her.
          </div>
        </div>
      </div>
    </div>
  );

  const content = (
    <>
      <style>{pulseShadowStyles}</style>
          <div
            className={cn(
              "space-y-6",
              embedded ? "px-0 pt-4 pr-4 pb-4" : "-ml-6 -mr-6 pl-3 pr-3",
              useExternalShell &&
                (showFinalActions ? "space-y-0 pt-0 pr-0 pb-0" : "h-full min-h-0 space-y-0 pt-0 pr-0 pb-0"),
            )}
            style={{ scrollbarGutter: "stable" }}
          >
            <div
              className={cn(
                "flex min-h-0 flex-col gap-6",
                embedded ? "" : "h-[calc(100dvh-var(--app-header-height,5rem)-3rem)] overflow-hidden",
              )}
            >
              {!embedded && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700">
                      Documents / Discipline /{" "}
                      <span className="text-[#2f9f35] underline underline-offset-4">
                        Warning Form
                      </span>{" "}
                      <span className="text-slate-700">({steps[activeStep]})</span>
                    </p>
                  </div>
                </div>
              )}

                {!showFinalActions ? (
                <div>
                  <Card
                    className={cn(
                      "rounded-sm mt-4 shadow-none border-0 bg-transparent",
                      useExternalShell && "mt-0 !backdrop-blur-none",
                      !embedded && "flex min-h-0 flex-col",
                    )}
                  >
                    {!embedded && (
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-center gap-8 w-full">
                        {steps.map((label, index) => {
                          const isFinalizedCurrent = showFinalActions && index === steps.length - 1;
                          const isDone = index < activeStep || isFinalizedCurrent;
                          const isActive = index === activeStep && !isFinalizedCurrent;
                          const Icon = stepIcons[index];
                          const circleClasses = isDone
                            ? "border-[#9dd8a2] text-[#1f7a25] bg-[#e9f9ee]"
                            : isActive
                              ? "border-[#9dd8a2] text-[#2f9f35] bg-[#e9f9ee]"
                              : "border-slate-300 text-slate-500 bg-slate-100";
                          const canClick = canNavigateToStep(index);
                          const handleClick = () => handleStepClick(index);

                          return (
                            <div key={label} className="flex items-center gap-4">
                              <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      disabled={!canClick}
                                      aria-label={label}
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
                                          ? "cursor-pointer hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3eca44] rounded-md"
                                          : "cursor-default"
                                      }`}
                                    >
                                      <div className={`flex h-11 w-11 items-center justify-center rounded-full border ${circleClasses}`}>
                                        <Icon className="h-5 w-5" />
                                      </div>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="center" className="text-xs">
                                    {label}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {index < steps.length - 1 && (
                                <div
                                  className={`h-px w-16 ${
                                    index < activeStep || isFinalizedCurrent ? "bg-[#3eca44]" : "bg-slate-300"
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
                      "pt-1 [&_label]:text-[10px] [&_label]:font-semibold [&_label]:text-slate-400 [&_input]:h-9 [&_input]:py-2 [&_button[role=combobox]]:h-9 [&_textarea]:py-2 [&_textarea]:text-sm",
                      embedded && "px-0",
                      !embedded && "flex-1 min-h-0 overflow-y-auto",
                      useExternalShell && "p-0 overflow-visible",
                    )}
                  >
                    <form onSubmit={handleSubmit} className="space-y-4">

                      <div className={cn("space-y-4", useExternalShell && "pr-1")}>
              {activeStep === 0 && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="client" className={modalFieldLabelClass}>
                      Select Client (optional)
                    </Label>
                    <Select
                      key={clientSelectResetCount}
                      value={formData.clientId || undefined}
                      onValueChange={handleClientSelect}
                      open={clientSearchOpen}
                      onOpenChange={(open) => {
                        setClientSearchOpen(open);
                        if (open) setClientSearchQuery("");
                      }}
                    >
                      <SelectTrigger className={`${getWarningModalSelectTriggerClass(formData.clientId.trim().length > 0)} ${warningModalDropdownToneClass}`}>
                        <SelectValue placeholder="Select from saved clients or fill manually" />
                      </SelectTrigger>
                      <SelectContent hideScrollButtons className="w-[var(--radix-select-trigger-width)] p-0">
                        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-2">
                          <Input
                            ref={clientSearchInputRef}
                            value={clientSearchQuery}
                            onChange={(event) => setClientSearchQuery(event.target.value)}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              (event.nativeEvent as KeyboardEvent).stopImmediatePropagation?.();
                            }}
                            onKeyUp={(event) => event.stopPropagation()}
                            placeholder="Type client name..."
                            className="h-8 rounded border-slate-300 text-[11px] placeholder:text-[10px] placeholder:text-slate-400"
                          />
                        </div>
                        {searchedClients.length > 0 ? (
                          searchedClients.map((client) => (
                            <SelectItem key={client.id} value={client.id} className={warningModalSelectItemClass}>
                              {String(client.registered_name || "").trim() || "Unnamed client"}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-[11px] text-slate-500">No matching clients found.</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyName" className={modalFieldLabelClass}>Company name</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        className={getWarningModalInputClass(formData.companyName.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="registrationNumber" className={modalFieldLabelClass}>Registration number</Label>
                      <Input
                        id="registrationNumber"
                        value={formData.registrationNumber}
                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                        className={getWarningModalInputClass(formData.registrationNumber.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="physicalAddress" className={modalFieldLabelClass}>Registered address</Label>
                      <Input
                        id="physicalAddress"
                        value={formData.physicalAddress}
                        onChange={(e) => setFormData({ ...formData, physicalAddress: e.target.value })}
                        className={getWarningModalInputClass(formData.physicalAddress.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tradingName" className={modalFieldLabelClass}>Trading name</Label>
                      <Input
                        id="tradingName"
                        value={formData.tradingName}
                        onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                        placeholder="If different from registered name"
                        className={getWarningModalInputClass(formData.tradingName.trim().length > 0)}
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
                        className={getWarningModalInputClass(formData.employerContact.trim().length > 0)}
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
                        className={getWarningModalInputClass(formData.employerEmail.trim().length > 0)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="employeeName" className={modalFieldLabelClass}>
                        Employee Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="employeeName"
                        value={formData.employeeName}
                        onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                        required
                        className={getWarningModalInputClass(formData.employeeName.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeSurname" className={modalFieldLabelClass}>
                        Employee Surname <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="employeeSurname"
                        value={formData.employeeSurname}
                        onChange={(e) => setFormData({ ...formData, employeeSurname: e.target.value })}
                        required
                        className={getWarningModalInputClass(formData.employeeSurname.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeIdNumber" className={modalFieldLabelClass}>
                        ID Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="employeeIdNumber"
                        value={formData.employeeIdNumber}
                        onChange={(e) => setFormData({ ...formData, employeeIdNumber: e.target.value })}
                        required
                        className={getWarningModalInputClass(formData.employeeIdNumber.trim().length > 0)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-start">
                    {activeWarnings.length > 0 && (
                      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help">
                              <Badge
                                variant="secondary"
                                className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
                              >
                                <Info className="mr-1 h-3 w-3" />
                                {activeWarnings.length} Active Warning{activeWarnings.length === 1 ? "" : "s"}
                              </Badge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            align="start"
                            className="max-w-[320px] border-[#9dd8a2] p-3 text-left"
                          >
                            <div className="space-y-2">
                              <div className="text-xs text-slate-500">Click on warning to view</div>
                              <div className="space-y-2">
                                {activeWarnings.map((warning) => {
                                  const warningType = coerceWarningType(warning.warning_type);
                                  const warningTone =
                                    warningType === "final"
                                      ? "text-red-700"
                                      : warningType === "serious"
                                        ? "text-amber-700"
                                        : warningType === "first" || warningType === "second"
                                          ? "text-emerald-700"
                                          : "text-slate-700";
                                  const label = warningType ? warningTypeLabels[warningType] : "Warning";
                                  const expiryDate = getWarningExpiryDate(warning);
                                  return (
                                    <div key={warning.id} className="text-xs text-slate-700">
                                      {warning.file_url ? (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenWarningFile(warning.file_url)}
                                          className={`font-semibold ${warningTone} text-left hover:underline hover:decoration-solid hover:underline-offset-2`}
                                        >
                                          {warning.misconduct_type || "Misconduct"}
                                        </button>
                                      ) : (
                                        <div className={`font-semibold ${warningTone}`}>
                                          {warning.misconduct_type || "Misconduct"}
                                        </div>
                                      )}
                                      <div>{label}</div>
                                      <div>Valid until: {formatDisplayDate(expiryDate)}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className={modalFieldLabelClass}>
                      Misconduct Type(s) <span className="text-red-500">*</span>
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openMisconductPicker}
                      className="h-[34px] w-full justify-between rounded border-[1.75px] border-slate-300 bg-white px-3 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-700"
                    >
                      <span>
                        {formData.misconductTypes.length === 0
                          ? "Select misconduct type(s)"
                          : `${formData.misconductTypes.length} type(s) selected`}
                      </span>
                      <span className="text-[10px] text-slate-500">Open selector</span>
                    </Button>
                    {formData.misconductTypes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formData.misconductTypes.map((type) => (
                          <Badge
                            key={type}
                            variant="secondary"
                            className={`gap-1 ${misconductColorClasses(getMisconductCategory(type))}`}
                          >
                            {type}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => toggleMisconductType(type)}
                            />
                          </Badge>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => updateMisconductTypes(() => [])}
                          className="h-6 px-2 text-[11px] text-slate-600 hover:text-[#2f9f35] hover:bg-[#3eca44]/10"
                        >
                          Clear all
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className={modalFieldLabelClass}>
                      Description of Misconduct <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Provide specific details about the misconduct incident(s) including dates"
                      rows={5}
                      required
                      className={`${getWarningModalInputClass(formData.description.trim().length > 0)} !min-h-[120px] !py-2`}
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="warningType" className={modalFieldLabelClass}>
                        Type of Warning <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        key={warningSelectKey}
                        onValueChange={handleWarningTypeChange}
                        value={formData.warningType || undefined}
                        open={warningSelectOpen}
                        onOpenChange={handleWarningSelectOpenChange}
                        required
                      >
                      <SelectTrigger className={`${getWarningModalSelectTriggerClass(Boolean(formData.warningType))} ${warningModalDropdownToneClass}`}>
                        <SelectValue placeholder="Select warning type" />
                      </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first" className={warningModalSelectItemClass}>First Written Warning</SelectItem>
                          <SelectItem value="second" className={warningModalSelectItemClass}>Second Written Warning</SelectItem>
                          <SelectItem value="serious" className={warningModalSelectItemClass}>Serious Written Warning</SelectItem>
                          <SelectItem value="final" className={warningModalSelectItemClass}>Final Written Warning</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validityMonths" className={modalFieldLabelClass}>
                        Validity Period (months) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="validityMonths"
                        type="number"
                        value={formData.validityMonths}
                        onChange={(e) => setFormData({ ...formData, validityMonths: e.target.value })}
                        required
                        readOnly
                        className={getWarningModalInputClass(formData.validityMonths.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="issuedBy" className={modalFieldLabelClass}>
                        Issued By <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="issuedBy"
                        value={formData.issuedBy}
                        onChange={(e) => setFormData({ ...formData, issuedBy: e.target.value })}
                        required
                        className={getWarningModalInputClass(formData.issuedBy.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateIssued" className={modalFieldLabelClass}>
                        Date of Issue <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-start gap-2">
                        <Input
                          id="dateIssued"
                          type="text"
                          readOnly
                          required
                          placeholder="Please select a date"
                          value={formData.dateIssued ? formatDisplayDate(formData.dateIssued) : ""}
                          onClick={openDateIssuedPicker}
                          onFocus={openDateIssuedPicker}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openDateIssuedPicker();
                            }
                          }}
                          className={`${getWarningModalInputClass(formData.dateIssued.trim().length > 0)} flex-1 cursor-pointer placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                        />
                        <input
                          ref={dateIssuedPickerRef}
                          type="date"
                          value={
                            formData.dateIssued && /^\d{4}-\d{2}-\d{2}$/.test(formData.dateIssued)
                              ? formData.dateIssued
                              : ""
                          }
                          onChange={(event) => setFormData({ ...formData, dateIssued: event.target.value })}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  {!(embedded && externalNavigation) ? (activeStep === steps.length - 1 ? (
                    <div className="flex w-full items-center gap-3 flex-wrap justify-between">
                      <div className="flex-none">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBack}
                          className="h-[28px] w-[84px] rounded border-[#3eca44] px-3 text-xs text-[#2f9f35] hover:bg-transparent hover:text-[#2f9f35]"
                        >
                          Back
                        </Button>
                      </div>
                      <div className="flex-1 flex justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleResetWarningStep}
                          disabled={isLoading}
                          className="gap-2 text-slate-700 hover:text-[#2f9f35] hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Reset form
                        </Button>
                      </div>
                      <div className="flex-none relative">
                        <Button
                          type="button"
                          onClick={handleFinish}
                          disabled={!isWarningStepComplete || isLoading}
                          className="h-[30px] w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b] disabled:bg-slate-300"
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
                            className="h-[28px] w-[84px] rounded border-[#3eca44] px-3 text-xs text-[#2f9f35] hover:bg-transparent hover:text-[#2f9f35]"
                          >
                            Back
                          </Button>
                        )}
                      </div>
                      <div className="flex-1" />
                      <div className="flex-none">
                        {activeStep < steps.length - 1 && (
                          <Button
                            type="button"
                            onClick={handleNext}
                            disabled={!canGoNext}
                            className="h-[28px] w-[84px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b] disabled:bg-slate-300"
                          >
                            Next
                          </Button>
                        )}
                      </div>
                    </div>
                  )) : null}
                </div>
                    </div>
                    </form>
                  </CardContent>
                  </Card>
                </div>
              ) : useExternalShell ? null : (
                <div>
                  <Card
                    className={cn(
                      "rounded-sm mt-4 shadow-none border-0 bg-transparent",
                      !embedded && "flex min-h-0 flex-col",
                    )}
                  >
                  <CardHeader className="pt-4 pb-0" />
                  <CardContent
                    className={cn(
                      "space-y-6 pt-2",
                      useExternalShell && "contents",
                      !embedded && "flex-1 min-h-0 overflow-y-auto",
                    )}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="h-[calc(62vh+25px)] overflow-auto border border-slate-300 bg-white p-4">
                        {renderPreviewPage()}
                      </div>
                      {!useExternalShell ? (
                        <div className="flex w-full items-center gap-2">
                          <div className="flex-none">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleBack}
                              className="h-[28px] w-[84px] rounded border-[#3eca44] px-3 text-xs text-[#2f9f35] hover:bg-transparent hover:text-[#2f9f35]"
                            >
                              Back
                            </Button>
                          </div>
                          <div className="flex-1" />
                          <div className="flex-none">
                            <Button
                              type="button"
                              onClick={handleDownload}
                              disabled={isLoading}
                              className="h-[30px] w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b] disabled:bg-slate-300"
                            >
                              Download
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

      {showFinalActions && useExternalShell ? (
        <Card className="rounded-sm mt-0 shadow-none border-0 bg-transparent contents !backdrop-blur-none">
          <CardHeader className="pt-4 pb-0" />
          <CardContent className="space-y-6 pt-2 contents">
            <ScrollArea className="h-[70vh] w-full rounded-sm bg-white px-6 pb-6">
              {renderPreviewPage()}
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={misconductPickerOpen} onOpenChange={(open) => (open ? openMisconductPicker() : cancelMisconductPicker())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <TriangleAlert className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">Select Misconduct Type(s)</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
            <div className="mt-[46px] bg-white">
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
              <div className="space-y-2 p-3">
                {filteredMisconductTypes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No misconduct types match your search.</p>
                )}
                {["Minor", "Serious", "Dismissible"].map((category) => {
                  const bucket = filteredMisconductTypes.filter((item) => item.category === category);
                  if (bucket.length === 0) return null;
                  return (
                    <div key={category} className="space-y-1">
                      <p
                        className={`text-xs font-semibold uppercase px-2 py-1 rounded ${
                          category === "Minor"
                            ? "bg-emerald-600 text-white"
                            : category === "Serious"
                              ? "bg-amber-600 text-white"
                              : "bg-red-600 text-white"
                        }`}
                      >
                        {category} Offences
                      </p>
                      {bucket.map((item) => (
                        <label
                          key={`${category}-${item.name}`}
                          className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-[#3eca44]/10/70 hover:text-[#2f9f35] focus-within:bg-[#3eca44]/10 ${warningModalSelectItemClass}`}
                        >
                          <Checkbox
                            checked={draftMisconductTypes.includes(item.name)}
                            onCheckedChange={() => handleDraftMisconductSelect(item.name)}
                            className="h-4 w-4 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                          />
                          <span className="flex-1">{item.name}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
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
                      variant="secondary"
                      className={`gap-1 ${misconductColorClasses(getMisconductCategory(type))}`}
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
                  className="h-[28px] w-[84px] rounded border-[#3eca44] px-3 text-xs text-[#2f9f35] hover:bg-transparent hover:text-[#2f9f35]"
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
                  className="h-[30px] w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={warningOverride.open} onOpenChange={(open) => !open && confirmOverrideWarning(false)}>
        <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <TriangleAlert className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">Caution</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
            <div className="mt-[46px] bg-white">
          <DialogHeader className="px-6 pt-5 pb-1">
            <DialogDescription className="py-1 text-[11px] text-slate-600">
              {warningOverride.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-6 pb-6 pt-0">
            <div className="flex w-full justify-center border-t border-dashed border-muted/60 pt-4">
              <div className="flex items-center gap-[42px]">
                <Button
                  type="button"
                  onClick={() => confirmOverrideWarning(false)}
                  className="h-[30px] w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
                >
                  No
                </Button>
                <Button
                  type="button"
                  onClick={() => confirmOverrideWarning(true)}
                  className="h-[28px] w-[84px] rounded border border-[#3eca44] bg-white px-3 text-xs text-[#2f9f35] hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35]"
                >
                  Yes
                </Button>
              </div>
            </div>
          </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dismissibleOverride.open} onOpenChange={(open) => !open && handleConfirmDismissible(false)}>
        <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <TriangleAlert className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Caution</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-5 pb-1">
            <DialogDescription className="py-1 text-[11px] text-slate-600">
              Issuing a warning for a dismissible offence may impact the consistency of disciplinary action and negatively impact a case before the CCMA or Bargaining Council in case of future dismissals. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-6 pb-6 pt-0">
            <div className="flex w-full justify-center border-t border-dashed border-muted/60 pt-4">
              <div className="flex items-center gap-[42px]">
                <Button
                  type="button"
                  onClick={() => handleConfirmDismissible(false)}
                  className="h-[30px] w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
                >
                  No
                </Button>
                <Button
                  type="button"
                  onClick={() => handleConfirmDismissible(true)}
                  className="h-[28px] w-[84px] rounded border border-[#3eca44] bg-white px-3 text-xs text-[#2f9f35] hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35]"
                >
                  Yes
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateWarningOverride.open} onOpenChange={(open) => !open && confirmDuplicateWarningOverride(false)}>
        <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <TriangleAlert className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Caution</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-5 pb-1">
            <DialogDescription className="py-1 text-[11px] text-slate-600">
              {duplicateWarningOverride.messageIntro}{" "}
              {duplicateWarningOverride.viewUrl && (
                <button
                  type="button"
                  onClick={() => handleOpenWarningFile(duplicateWarningOverride.viewUrl)}
                  className="font-semibold text-[#2f9f35] hover:text-[#1f7a25] underline underline-offset-2"
                >
                  View here
                </button>
              )}
              {duplicateWarningOverride.messagePrompt && (
                <span className="mt-3 block whitespace-pre-line">{duplicateWarningOverride.messagePrompt}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-6 pb-6 pt-0">
            <div className="flex w-full justify-center border-t border-dashed border-muted/60 pt-4">
              <div className="flex items-center gap-[42px]">
                <Button
                  type="button"
                  onClick={() => confirmDuplicateWarningOverride(false)}
                  className="h-[30px] w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
                >
                  No
                </Button>
                <Button
                  type="button"
                  onClick={() => confirmDuplicateWarningOverride(true)}
                  className="h-[28px] w-[84px] rounded border border-[#3eca44] bg-white px-3 text-xs text-[#2f9f35] hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35]"
                >
                  Yes
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mixedCategoryCaution.open} onOpenChange={(open) => !open && closeMixedCategoryCaution()}>
        <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <TriangleAlert className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Caution</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-5 pb-1">
            <DialogDescription className="py-1 text-[11px] text-slate-600">
              The selected misconduct types are from different categories.
              <span className="mt-3 block">
                "{mixedCategoryCaution.existingMisconduct || "Selected misconduct"}" falls under{" "}
                {mixedCategoryCaution.existingCategory || "another"} offences, while "
                {mixedCategoryCaution.attemptedMisconduct || "the added misconduct"}" falls under{" "}
                {mixedCategoryCaution.attemptedCategory || "a different"} offences.
              </span>
              <span className="mt-3 block">
                Recommendation: Issue separate warnings for misconduct types from different categories.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-6 pb-6 pt-0">
            <div className="flex w-full justify-center border-t border-dashed border-muted/60 pt-4">
              <Button
                type="button"
                onClick={closeMixedCategoryCaution}
                className="h-[30px] w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
              >
                OK
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default WarningGenerator;








