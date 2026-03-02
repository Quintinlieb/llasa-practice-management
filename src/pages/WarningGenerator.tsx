import { useState, useEffect, useMemo, useCallback, useRef, type ComponentType, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, X, Info, ArrowRight, RotateCcw, Building2, User2, Briefcase, Check, TriangleAlert } from "lucide-react";
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

type WarningEmployee = Pick<Tables<"employees">, "id" | "employee_name" | "employee_surname" | "id_number">;
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
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};
const normalizeMisconduct = (value?: string | null) => (value || "").trim().toLowerCase();
const coerceWarningType = (value?: string | null) => {
  const normalized = (value || "").toLowerCase();
  if (normalized === "first" || normalized === "second" || normalized === "serious" || normalized === "final") {
    return normalized as WarningGeneratorFormData["warningType"];
  }
  return "" as WarningGeneratorFormData["warningType"] | "";
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
const WarningGenerator = ({
  embedded = false,
  onStepChange,
  onStepMetaChange,
}: {
  embedded?: boolean;
  onStepChange?: (step: string | null) => void;
  onStepMetaChange?: (meta: {
    steps: readonly string[];
    activeStep: number;
    icons?: readonly ComponentType<SVGProps<SVGSVGElement>>[];
    canGoNext?: boolean;
    canGoBack?: boolean;
    onNext?: () => void;
    onBack?: () => void;
    isFinished?: boolean;
  }) => void;
}) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [employees, setEmployees] = useState<WarningEmployee[]>([]);
  const [employeeWarnings, setEmployeeWarnings] = useState<EmployeeWarningRow[]>([]);
  const [misconductSearch, setMisconductSearch] = useState("");
  const [isMisconductMenuOpen, setIsMisconductMenuOpen] = useState(false);
  const misconductPopoverRef = useRef<HTMLDivElement | null>(null);
  const [warningSelectResetCount, setWarningSelectResetCount] = useState(0);
  const [employeeSelectResetCount, setEmployeeSelectResetCount] = useState(0);
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
  }>({ open: false, pending: null });
  const [duplicateOverrideAccepted, setDuplicateOverrideAccepted] = useState(false);
  const [formData, setFormData] = useState<WarningFormData>({
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
  const steps = ["Employer Details", "Employee Details", "Warning Details"] as const;
  const stepIcons = [Building2, User2, TriangleAlert] as const;
  const [activeStep, setActiveStep] = useState(0);
  const [showFinalActions, setShowFinalActions] = useState(false);
  const [showEmployeeHint, setShowEmployeeHint] = useState(false);
  const [hasDismissedEmployeeHint, setHasDismissedEmployeeHint] = useState(false);
  const baseModalFieldClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default";
  const warningModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-blue-400 data-[state=open]:border-slate-300 data-[state=open]:bg-white";
  const warningModalSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700";
  const getWarningModalInputClass = (isComplete: boolean) =>
    `${baseModalFieldClass} !h-[34px] !border-[0.5px] !border-slate-400 !focus-visible:border-slate-300 ${isComplete ? "!border-emerald-500" : ""}`;
  const getWarningModalSelectTriggerClass = (isComplete: boolean) =>
    `${baseModalFieldClass} justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs !h-[34px] !border-[0.5px] !border-slate-400 !focus:border-blue-600 !focus-visible:border-blue-600 data-[state=open]:!border-blue-600 !ring-0 !ring-offset-0 !outline-none !shadow-none !focus:ring-0 !focus:ring-offset-0 !focus:shadow-none !focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:shadow-none !focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none ${isComplete ? "!border-emerald-500" : ""}`;
  const modalFieldLabelClass = "text-[10px] font-semibold text-slate-400";

  useEffect(() => {
    if (!embedded) return;
    onStepChange?.(showFinalActions ? "Preview / Download" : (steps[activeStep] ?? null));
  }, [activeStep, embedded, onStepChange, showFinalActions, steps]);


  useEffect(() => {
    if (formData.misconductTypes.length === 0) {
      setFormData((prev) => {
        if (!prev.warningType && !prev.validityMonths) return prev;
        return { ...prev, warningType: "", validityMonths: "" };
      });
      setWarningSelectOpen(false);
    }
  }, [formData.misconductTypes.length]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (hasDismissedEmployeeHint || activeStep !== 1) {
      setShowEmployeeHint(false);
      return;
    }
    const timer = setTimeout(() => setShowEmployeeHint(true), 1000);
    return () => clearTimeout(timer);
  }, [activeStep, hasDismissedEmployeeHint]);

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

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
    }
  }, [user]);

  const fetchEmployees = useCallback(async () => {
    if (!user) return;

    const { data } = await (supabase as any)
      .from("employees")
      .select("id, employee_name, employee_surname, id_number")
      .eq("company_id", user.id);

    if (data) {
      setEmployees(data);
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
      fetchProfile();
      fetchEmployees();
      fetchConductOffences();
    }
  }, [user, fetchProfile, fetchEmployees, fetchConductOffences]);

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        employerContact: prev.employerContact || profile.company_contact || "",
        employerEmail: prev.employerEmail || profile.company_email || "",
      }));
    }
  }, [profile]);

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

  const misconductCheckboxClasses = (category: "Minor" | "Serious" | "Dismissible") => {
    if (category === "Minor") return "border-emerald-500 data-[state=checked]:bg-emerald-100 data-[state=checked]:border-emerald-600 text-emerald-700";
    if (category === "Serious") return "border-amber-500 data-[state=checked]:bg-amber-100 data-[state=checked]:border-amber-600 text-amber-700";
    return "border-red-500 data-[state=checked]:bg-red-100 data-[state=checked]:border-red-600 text-red-700";
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
    const label = warningType ? warningTypeLabels[warningType] : "Warning";
    const expiryDate = getWarningExpiryDate(warning);
    const expiryDisplay = expiryDate ? formatDisplayDate(expiryDate) : "--";
    return {
      intro: `The employee already has a ${label} for "${misconduct}" that is valid until ${expiryDisplay}.`,
      prompt:
        "If you override your code of conduct it may result in disciplinary inconsistency. Do you wish to override and proceed with this warning?",
    };
  };

  const findDuplicateWarning = (
    misconductTypes: string[],
    warningType: WarningGeneratorFormData["warningType"] | "",
  ) => {
    if (!formData.employeeId || !warningType || employeeWarnings.length === 0) return null;
    const normalizedWarningType = warningType.toLowerCase();
    const activeWarnings = employeeWarnings.filter(isWarningActive);

    for (const misconduct of misconductTypes) {
      const normalizedMisconduct = normalizeMisconduct(misconduct);
      const warningMatch = activeWarnings.find((warning) => {
        const warningTypeMatch = coerceWarningType(warning.warning_type);
        if (!warningTypeMatch || warningTypeMatch !== normalizedWarningType) return false;
        return normalizeMisconduct(warning.misconduct_type) === normalizedMisconduct;
      });
      if (warningMatch) {
        return { warning: warningMatch, misconduct };
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
      updateMisconductTypes((prev) => {
        if (prev.includes(dismissibleOverride.pending!)) return prev;
        return [...prev, dismissibleOverride.pending!];
      });
    }
    setDismissibleOverride({ open: false, pending: null });
  };

  const handleMisconductMenuOpenChange = (open: boolean) => {
    setIsMisconductMenuOpen(open);
    if (!open) {
      setMisconductSearch("");
    }
  };

  useEffect(() => {
    if (!isMisconductMenuOpen) return;
    const handleScrollClose = (event: Event) => {
      const target = event.target as Node | null;
      if (target && misconductPopoverRef.current?.contains(target)) {
        return; // allow internal scrolling without closing
      }
      handleMisconductMenuOpenChange(false);
    };
    window.addEventListener("scroll", handleScrollClose, true);
    return () => window.removeEventListener("scroll", handleScrollClose, true);
  }, [isMisconductMenuOpen]);

  const handleMisconductSelect = (type: string) => {
    const isSelected = formData.misconductTypes.includes(type);
    if (isSelected) {
      updateMisconductTypes((prev) => prev.filter((item) => item !== type));
      return;
    }

    const newCategory = getMisconductCategory(type);
    const currentCategory =
      formData.misconductTypes.length > 0 ? getMisconductCategory(formData.misconductTypes[0]) : null;
    if (newCategory === "Dismissible") {
      setDismissibleOverride({ open: true, pending: type });
      return;
    }
    if (currentCategory && newCategory !== currentCategory) {
      toast({
        title: "Choose one category",
        description: "Select misconduct types from the same category only.",
        variant: "destructive",
      });
      return;
    }

    updateMisconductTypes((prev) => [...prev, type]);
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

    if (formData.misconductTypes.length > 0 && (conductOffences.length === 0 || matchedCount === 0)) {
      resetWarningSelection();
      setWarningSelectOpen(false);
      setWarningOverride({
        open: true,
        message: `No Code of Conduct warning was found for the selected misconduct. Override and use "${value}" instead?`,
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
        message: `The Code of Conduct prescribes "${prescribed}" for ${selectionRequirement.type}. Override and use "${value}" instead?`,
        next: value,
      });
      return;
    }

    applyWarningTypeWithDuplicateCheck(value);
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      setFormData({
        ...formData,
        employeeId,
        employeeName: employee.employee_name,
        employeeSurname: employee.employee_surname,
        employeeIdNumber: employee.id_number ?? "",
      });
      setEmployeeSelectResetCount((prev) => prev + 1);
    }
  };
  const handleOpenWarningFile = useCallback((fileUrl: string | null) => {
    if (!fileUrl) return;
    window.open(fileUrl, "_blank", "noopener,noreferrer");
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
      doc.text(label, margin + 4, yPosition + sectionHeight - 2);
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

    if (profile) {
      drawSectionTitle("A. EMPLOYER DETAILS");
      renderLabelValue("Company Name:", profile.company_name || "-");
      renderLabelValue("Reg No:", profile.registration_number || "-");
      renderLabelValue("Company Address:", profile.physical_address || "-");
      if (formData.tradingName) {
        renderLabelValue("Trading As:", formData.tradingName);
      }
      renderLabelValue("Employer Contact:", formData.employerContact || "-");
      renderLabelValue("Employer Email:", formData.employerEmail || "-");
      yPosition += 4;
    }

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
    setIsMisconductMenuOpen(false);
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
    setIsMisconductMenuOpen(false);
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

  const handleResetEmployeeStep = () => {
    setFormData((prev) => ({
      ...prev,
      employeeId: "",
      employeeName: "",
      employeeSurname: "",
      employeeIdNumber: "",
    }));
    setEmployeeSelectResetCount((prev) => prev + 1);
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

  const handleNext = () => {
    if (activeStep >= steps.length - 1) return;
    if (!canGoNext) return;
    if (activeStep === 0 && showEmployeeHint) {
      setShowEmployeeHint(false);
    }
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const canAdvance = activeStep === steps.length - 1 ? isWarningStepComplete : canGoNext;

  const handleNextOrFinish = () => {
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
      onNext: handleNextOrFinish,
      onBack: handleBack,
      isFinished: showFinalActions,
    });
  }, [
    activeStep,
    embedded,
    onStepMetaChange,
    steps,
    stepIcons,
    canAdvance,
    handleNextOrFinish,
    handleBack,
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
  const renderPreviewPage = () => (
    <div className="bg-white text-black px-8 pt-2 pb-8 mx-auto" style={{ width: "210mm", minHeight: "297mm" }}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-black">DISCIPLINARY WARNING NOTICE</h1>
      </div>

      <div className="space-y-5 text-sm text-black">
        {/* Employer Details */}
        {profile && (
          <div className="space-y-2">
            <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
              A. Employer Details
            </div>
            <div className="text-xs space-y-1">
              <div className="grid grid-cols-[140px,1fr] gap-2">
                <span className="font-semibold">Company Name:</span>
                <span>{profile.company_name}</span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2">
                <span className="font-semibold">Reg No:</span>
                <span>{profile.registration_number}</span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2">
                <span className="font-semibold">Company Address:</span>
                <span>{profile.physical_address}</span>
              </div>
              {formData.tradingName && (
                <div className="grid grid-cols-[140px,1fr] gap-2">
                  <span className="font-semibold">Trading As:</span>
                  <span>{formData.tradingName}</span>
                </div>
              )}
              <div className="grid grid-cols-[140px,1fr] gap-2">
                <span className="font-semibold">Employer Contact:</span>
                <span>{formData.employerContact || "-"}</span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2">
                <span className="font-semibold">Employer Email:</span>
                <span>{formData.employerEmail || "-"}</span>
              </div>
            </div>
          </div>
        )}

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
      {showEmployeeHint && typeof document !== "undefined"
        ? createPortal(
              <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
                <div className="relative flex translate-x-[60px] items-center gap-3 rounded-sm border border-blue-200 bg-[#2D4256] px-4 py-3 text-[13px] font-medium text-white shadow-[0_6px_18px_rgba(37,99,235,0.28)]">
                <span
                  className="pointer-events-none absolute inset-0 rounded-sm shadow-[0_0_25px_rgba(37,99,235,0.32)] animate-pulse"
                  aria-hidden="true"
                ></span>
                <div className="pointer-events-auto flex items-center gap-2">
                  <span className="text-blue-400">
                    TIP!{" "}
                    <span className="text-white inline-flex items-center gap-1 ml-2">
                      Add the employee to your Employee List before generating a warning
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
              "relative",
              embedded ? "px-0 pt-4 pr-1 pb-4" : "-ml-6 -mr-6 pl-3 pr-3",
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
                      <span className="text-blue-700 underline underline-offset-4">
                        Warning Form
                      </span>{" "}
                      <span className="text-slate-700">({steps[activeStep]})</span>
                    </p>
                  </div>
                </div>
              )}

                {!showFinalActions ? (
                <div className="translate-y-[-10px]">
                  <Card
                    className={cn(
                      "flex-1 rounded-sm shadow-none bg-transparent border-0",
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
                            ? "border-[#b6e6c1] text-[#038314] bg-[#e9f9ee]"
                            : isActive
                              ? "border-blue-300 text-blue-700 bg-blue-100"
                              : "border-slate-200 text-slate-500 bg-white";
                          const canClick = showFinalActions || index < activeStep;
                          const handleClick = () => {
                            if (showFinalActions) {
                              setShowFinalActions(false);
                              setActiveStep(index);
                            } else if (index < activeStep) {
                              setActiveStep(index);
                            }
                          };

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
                                          ? "cursor-pointer hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
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
                      "pt-[11px] [&_input]:h-9 [&_input]:py-2 [&_button[role=combobox]]:h-9 [&_textarea]:py-2 [&_textarea]:text-sm",
                      embedded && "px-0",
                      !embedded && "flex-1 min-h-0 overflow-y-auto",
                    )}
                  >
                    <form onSubmit={handleSubmit} className="space-y-4">

                      <div className="space-y-4">
                {activeStep === 0 && (
                  <div className="space-y-3 rounded-sm border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                      <Label htmlFor="companyName" className={modalFieldLabelClass}>Company name</Label>
                      <Input
                        id="companyName"
                        value={profile?.company_name || ""}
                        readOnly
                        className={getWarningModalInputClass(Boolean(profile?.company_name))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="registrationNumber" className={modalFieldLabelClass}>Registration number</Label>
                      <Input
                        id="registrationNumber"
                        value={profile?.registration_number || ""}
                        readOnly
                        className={getWarningModalInputClass(Boolean(profile?.registration_number))}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="physicalAddress" className={modalFieldLabelClass}>Registered address</Label>
                      <Input
                        id="physicalAddress"
                        value={profile?.physical_address || ""}
                        readOnly
                        className={getWarningModalInputClass(Boolean(profile?.physical_address))}
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
                      <Label htmlFor="employerContact" className={modalFieldLabelClass}>Employer contact *</Label>
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
                      <Label htmlFor="employerEmail" className={modalFieldLabelClass}>Employer email *</Label>
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
                <div className="space-y-3 rounded-sm border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="space-y-2">
                    <Label htmlFor="employee" className={modalFieldLabelClass}>
                      Select Employee (optional)
                    </Label>
                    <Select key={employeeSelectResetCount} onValueChange={handleEmployeeSelect}>
                      <SelectTrigger className={`${getWarningModalSelectTriggerClass(formData.employeeId.trim().length > 0)} ${warningModalDropdownToneClass}`}>
                        <SelectValue placeholder="Select from saved employees or fill manually" />
                      </SelectTrigger>
                      <SelectContent className="w-[var(--radix-select-trigger-width)]">
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id} className={warningModalSelectItemClass}>
                            {employee.employee_name} {employee.employee_surname}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="employeeName" className={modalFieldLabelClass}>
                        Employee Name *
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
                        Employee Surname *
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
                        ID Number *
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
                <div className="space-y-3 rounded-sm border border-slate-200 bg-white p-3 shadow-sm">
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
                            className="max-w-[320px] border-blue-200 p-3 text-left"
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
                    <Label className={modalFieldLabelClass}>Misconduct Type(s) *</Label>
                    <Popover open={isMisconductMenuOpen} onOpenChange={handleMisconductMenuOpenChange}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`${getWarningModalSelectTriggerClass(formData.misconductTypes.length > 0)} ${warningModalDropdownToneClass} w-full justify-start text-left font-normal`}
                          type="button"
                        >
                          {formData.misconductTypes.length === 0
                            ? "Select misconduct type(s)"
                            : `${formData.misconductTypes.length} type(s) selected`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent ref={misconductPopoverRef} className="w-[420px] p-4" align="start">
                        <div className="space-y-3">
                          <Input
                            placeholder="Search misconduct types"
                            value={misconductSearch}
                            onChange={(e) => setMisconductSearch(e.target.value)}
                          />
                          <ScrollArea className="h-56 rounded-md border border-muted">
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
                                      className={`text-xs font-semibold uppercase px-2 py-1 rounded-sm ${
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
                                        className={`flex items-center gap-2 text-sm cursor-pointer ${misconductColorClasses(item.category)}`}
                                      >
                                        <Checkbox
                                          checked={formData.misconductTypes.includes(item.name)}
                                          onCheckedChange={() => handleMisconductSelect(item.name)}
                                          className={misconductCheckboxClasses(item.category)}
                                        />
                                        <span className="flex-1">{item.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                          {formData.misconductTypes.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Selected</p>
                              <div className="flex flex-wrap gap-2">
                                {formData.misconductTypes.map((type) => {
                                  const category = getMisconductCategory(type);
                                  return (
                                    <Badge
                                      key={type}
                                      variant="secondary"
                                      className={`gap-1 ${misconductColorClasses(category)}`}
                                    >
                                      {type}
                                      <X className="h-3 w-3 cursor-pointer" onClick={() => toggleMisconductType(type)} />
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {formData.misconductTypes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
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
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className={modalFieldLabelClass}>
                      Description of Misconduct *
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
                        Type of Warning *
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
                        Validity Period (months) *
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
                        Issued By *
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
                        Date of Issue *
                      </Label>
                      <Input
                        id="dateIssued"
                        type="date"
                        value={formData.dateIssued}
                        onChange={(e) => setFormData({ ...formData, dateIssued: e.target.value })}
                        required
                        className={getWarningModalInputClass(formData.dateIssued.trim().length > 0)}
                      />
                    </div>
                  </div>
                </div>
              )}

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
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleResetWarningStep}
                          disabled={isLoading}
                          className="gap-2 text-slate-700 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300"
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
                      <div className="flex-1" />
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
                    </div>
                    </form>
                  </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="translate-y-[-10px]">
                  <Card
                    className={cn(
                      "flex-1 rounded-sm shadow-none bg-transparent border-0",
                      !embedded && "flex min-h-0 flex-col",
                    )}
                  >
                  <CardHeader className="pt-4 pb-0" />
                  <CardContent
                    className={cn(
                      "space-y-6 pt-2",
                      !embedded && "flex-1 min-h-0 overflow-y-auto",
                    )}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="h-[62vh] overflow-auto rounded-sm border border-slate-200 bg-slate-50 p-4">
                        {renderPreviewPage()}
                      </div>
                      <div className="flex w-full items-center gap-2">
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
                        <div className="flex-1" />
                        <div className="flex-none">
                          <Button
                            type="button"
                            onClick={handleDownload}
                            disabled={isLoading}
                            className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

      <Dialog open={warningOverride.open} onOpenChange={(open) => !open && confirmOverrideWarning(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-4 text-center">
            <DialogTitle className="text-blue-700 text-xl w-full text-center">
              Caution
            </DialogTitle>
            <DialogDescription className="mt-8 block text-gray-700 text-center">
              {warningOverride.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <div className="flex w-full justify-center gap-2">
              <Button
                onClick={() => confirmOverrideWarning(false)}
                className="min-w-[120px] border-2 border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white text-base"
              >
                No
              </Button>
              <Button
                variant="outline"
                onClick={() => confirmOverrideWarning(true)}
                className="min-w-[90px] text-sm text-gray-700 hover:text-blue-700 hover:bg-white hover:border-blue-600"
              >
                Yes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dismissibleOverride.open} onOpenChange={(open) => !open && handleConfirmDismissible(false)}>
        <DialogContent className="sm:max-w-2xl sm:w-[640px]">
          <DialogHeader className="space-y-4 text-center">
            <DialogTitle className="text-blue-700 text-xl w-full text-center">
              Caution
            </DialogTitle>
            <DialogDescription className="mt-8 block text-gray-700 text-center">
              Issuing a warning for a dismissible offence may impact the consistency of disciplinary action and negatively impact a case before the CCMA or Bargaining Council in case of future dismissals. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <div className="flex w-full justify-center gap-2">
              <Button
                onClick={() => handleConfirmDismissible(false)}
                className="min-w-[120px] border-2 border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white text-base"
              >
                No
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfirmDismissible(true)}
                className="min-w-[90px] text-sm text-gray-700 hover:text-blue-700 hover:bg-white hover:border-blue-600"
              >
                Yes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateWarningOverride.open} onOpenChange={(open) => !open && confirmDuplicateWarningOverride(false)}>
        <DialogContent className="sm:max-w-2xl sm:w-[720px]">
          <DialogHeader className="space-y-4 text-center">
            <DialogTitle className="text-blue-700 text-xl w-full text-center">
              Caution
            </DialogTitle>
            <DialogDescription className="mt-8 block text-gray-700 text-center">
              {duplicateWarningOverride.messageIntro}{" "}
              {duplicateWarningOverride.viewUrl && (
                <button
                  type="button"
                  onClick={() => handleOpenWarningFile(duplicateWarningOverride.viewUrl)}
                  className="font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2"
                >
                  View here
                </button>
              )}
              {duplicateWarningOverride.messagePrompt && (
                <span className="mt-3 block">{duplicateWarningOverride.messagePrompt}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <div className="flex w-full justify-center gap-2">
              <Button
                onClick={() => confirmDuplicateWarningOverride(false)}
                className="min-w-[120px] border-2 border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white text-base"
              >
                No
              </Button>
              <Button
                variant="outline"
                onClick={() => confirmDuplicateWarningOverride(true)}
                className="min-w-[90px] text-sm text-gray-700 hover:text-blue-700 hover:bg-white hover:border-blue-600"
              >
                Yes
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






