import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Plus, X, User, UserPlus, Users, Building2, Lock, Palette, SlidersHorizontal, MapPin, Settings as SettingsIcon, Search, Network, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { z } from "zod";
import { companySetupBaseSchema, southAfricanProvinces } from "@/lib/validation";
import { getSafeErrorMessage } from "@/lib/errorHandling";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character");

type SettingsProps = {
  embedded?: boolean;
  onClose?: () => void;
};

type BranchEntry = {
  name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  province: string;
  area_code: string;
};

type UserDetailsForm = {
  user_name: string;
  user_surname: string;
  user_email: string;
  user_contact: string;
};

type CompanyDetailsForm = {
  company_type: string;
  company_name: string;
  registration_number: string;
  vat_number: string;
  physical_address_line1: string;
  physical_address_line2: string;
  city: string;
  province: string;
  area_code: string;
  postal_address_line1: string;
  postal_address_line2: string;
  postal_city: string;
  postal_province: string;
  postal_area_code: string;
  representative_name: string;
  representative_surname: string;
  company_contact: string;
  company_email: string;
};

type BranchSettingsForm = {
  branches_enabled: boolean;
  branches: BranchEntry[];
};

type SubuserInviteForm = {
  name: string;
  surname: string;
  contact_number: string;
  email: string;
  role: "Main" | "Consultant" | "Administrator" | "";
  username: string;
  password: string;
  confirmPassword: string;
};
type SubuserListItem = {
  id: string;
  name: string;
  surname: string;
  contact_number: string | null;
  email: string;
  role: string | null;
  created_at: string | null;
};

type BranchAllocationEmployee = {
  id: string;
  employee_name: string;
  employee_surname: string;
  id_number: string;
  branch: string;
  branchNames: string[];
};

type SettingsTab = "user" | "subusers" | "company" | "companyAddress" | "companySetup" | "auth" | "personalize";
type ProfileDataGroup = "user" | "company" | "branches" | "personalize";

const DEFAULT_COMPANY_NAME = "The Labour Law Association South Africa CC";
const DEFAULT_TRADING_AS = "LLASA";
const DEFAULT_REGISTRATION_NUMBER = "2009/057603/23";
const DEFAULT_VAT_NUMBER = "4660294549";
const DEFAULT_REPRESENTATIVE_NAME = "Quintin";
const DEFAULT_REPRESENTATIVE_SURNAME = "Liebenberg";
const DEFAULT_COMPANY_CONTACT = "0137522977";
const DEFAULT_COMPANY_EMAIL = "info@llasa.co.za";
const DEFAULT_PHYSICAL_ADDRESS_LINE1 = "Office 03, Collfin House";
const DEFAULT_PHYSICAL_ADDRESS_LINE2 = "11 Ferreira Street";
const DEFAULT_CITY = "Nelspruit";
const DEFAULT_PROVINCE = "Mpumalanga";
const DEFAULT_AREA_CODE = "1201";

const emptyUserDetails: UserDetailsForm = {
  user_name: "",
  user_surname: "",
  user_email: "",
  user_contact: "",
};

const emptyCompanyDetails: CompanyDetailsForm = {
  company_type: DEFAULT_TRADING_AS,
  company_name: DEFAULT_COMPANY_NAME,
  registration_number: DEFAULT_REGISTRATION_NUMBER,
  vat_number: DEFAULT_VAT_NUMBER,
  physical_address_line1: DEFAULT_PHYSICAL_ADDRESS_LINE1,
  physical_address_line2: DEFAULT_PHYSICAL_ADDRESS_LINE2,
  city: DEFAULT_CITY,
  province: DEFAULT_PROVINCE,
  area_code: DEFAULT_AREA_CODE,
  postal_address_line1: DEFAULT_PHYSICAL_ADDRESS_LINE1,
  postal_address_line2: DEFAULT_PHYSICAL_ADDRESS_LINE2,
  postal_city: DEFAULT_CITY,
  postal_province: DEFAULT_PROVINCE,
  postal_area_code: DEFAULT_AREA_CODE,
  representative_name: DEFAULT_REPRESENTATIVE_NAME,
  representative_surname: DEFAULT_REPRESENTATIVE_SURNAME,
  company_contact: DEFAULT_COMPANY_CONTACT,
  company_email: DEFAULT_COMPANY_EMAIL,
};

const emptyBranchSettings: BranchSettingsForm = {
  branches_enabled: false,
  branches: [],
};

const emptyBranchForm: BranchEntry = {
  name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  province: "",
  area_code: "",
};

const emptySubuserInviteForm: SubuserInviteForm = {
  name: "",
  surname: "",
  contact_number: "",
  email: "",
  role: "",
  username: "",
  password: "",
  confirmPassword: "",
};

const parseEmployeeBranchNames = (value: string): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const part of value.split(",")) {
    const normalized = part.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
};

const serializeEmployeeBranchNames = (values: string[]): string | null => {
  if (values.length === 0) return null;
  return values.join(", ");
};

const employeeHasBranch = (employee: BranchAllocationEmployee, branchName: string) =>
  employee.branchNames.some((name) => name.toLowerCase() === branchName.trim().toLowerCase());

type SettingsProfileCache = {
  userDetails?: UserDetailsForm;
  companyDetails?: CompanyDetailsForm;
  branchSettings?: BranchSettingsForm;
  personalise?: {
    preview: string;
    layout: "vertical" | "horizontal" | null;
  };
  loadedGroups: Set<ProfileDataGroup>;
};

const settingsProfileCacheByUser = new Map<string, SettingsProfileCache>();
let personalizeColumnsSupported: boolean | null = null;

const tabToProfileGroup: Record<SettingsTab, ProfileDataGroup | null> = {
  user: "user",
  subusers: null,
  company: "company",
  companyAddress: "company",
  companySetup: "branches",
  auth: null,
  personalize: "personalize",
};

const profileGroupToTabs: Record<ProfileDataGroup, SettingsTab[]> = {
  user: ["user"],
  company: ["company", "companyAddress"],
  branches: ["companySetup"],
  personalize: ["personalize"],
};

const emptyTabLoadingState: Record<SettingsTab, boolean> = {
  user: false,
  subusers: false,
  company: false,
  companyAddress: false,
  companySetup: false,
  auth: false,
  personalize: false,
};

const allSettingsTabs: SettingsTab[] = ["user", "subusers", "company", "companyAddress", "companySetup", "auth", "personalize"];

const parseAddressParts = (address: string) => {
  const addressParts = (address || "")
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const hasFourParts = addressParts.length === 4;

  return {
    physical_address_line1: hasFourParts ? "" : addressParts[0] || "",
    physical_address_line2: hasFourParts ? addressParts[0] || "" : addressParts[1] || "",
    city: hasFourParts ? addressParts[1] || "" : addressParts[2] || "",
    province: hasFourParts ? addressParts[2] || "" : addressParts[3] || "",
    area_code: hasFourParts ? addressParts[3] || "" : addressParts[4] || "",
  };
};

const parsePostalAddressParts = (postalAddress: string) => {
  const postalAddressParts = (postalAddress || "")
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const postalHasFiveParts = postalAddressParts.length >= 5;
  const postalHasFourParts = postalAddressParts.length === 4;

  return {
    postal_address_line1: postalAddressParts[0] || "",
    postal_address_line2: postalHasFiveParts ? postalAddressParts[1] || "" : "",
    postal_city: postalHasFiveParts ? postalAddressParts[2] || "" : postalHasFourParts ? postalAddressParts[1] || "" : "",
    postal_province: postalHasFiveParts ? postalAddressParts[3] || "" : postalHasFourParts ? postalAddressParts[2] || "" : "",
    postal_area_code: postalHasFiveParts ? postalAddressParts[4] || "" : postalHasFourParts ? postalAddressParts[3] || "" : "",
  };
};

const parseBranchValues = (branches: unknown): BranchEntry[] =>
  Array.isArray(branches)
    ? branches
        .map((value: unknown) => {
          if (typeof value === "string") {
            const raw = value.trim();
            let name = raw;
            let addressLine1 = "";
            let addressLine2 = "";
            let city = "";
            let province = "";
            let areaCode = "";
            if (raw.startsWith("{") && raw.endsWith("}")) {
              try {
                const parsed = JSON.parse(raw) as Record<string, unknown>;
                name = String(parsed.name ?? "").trim() || raw;
                addressLine1 = String(parsed.address_line1 ?? "").trim();
                addressLine2 = String(parsed.address_line2 ?? "").trim();
                city = String(parsed.city ?? "").trim();
                province = String(parsed.province ?? "").trim();
                areaCode = String(parsed.area_code ?? "").trim();
              } catch {
                // Keep raw string fallback for legacy values.
              }
            }
            if (!name) return null;
            return {
              name,
              address_line1: addressLine1,
              address_line2: addressLine2,
              city,
              province,
              area_code: areaCode,
            } as BranchEntry;
          }
          if (value && typeof value === "object") {
            const record = value as Record<string, unknown>;
            const name = String(record.name ?? "").trim();
            if (!name) return null;
            return {
              name,
              address_line1: String(record.address_line1 ?? "").trim(),
              address_line2: String(record.address_line2 ?? "").trim(),
              city: String(record.city ?? "").trim(),
              province: String(record.province ?? "").trim(),
              area_code: String(record.area_code ?? "").trim(),
            } as BranchEntry;
          }
          return null;
        })
        .filter((value): value is BranchEntry => Boolean(value))
    : [];

const isPersonalizeColumnError = (error: unknown) => {
  const err = error as { code?: string; message?: string } | null;
  const message = String(err?.message || "").toLowerCase();
  return err?.code === "42703" || (message.includes("column") && message.includes("company_logo"));
};

const Settings = ({ embedded = false, onClose }: SettingsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [userDetails, setUserDetails] = useState<UserDetailsForm>(emptyUserDetails);
  const [initialUserDetails, setInitialUserDetails] = useState<UserDetailsForm>(emptyUserDetails);

  const [companyDetails, setCompanyDetails] = useState<CompanyDetailsForm>(emptyCompanyDetails);
  const [initialCompanyDetails, setInitialCompanyDetails] = useState<CompanyDetailsForm>(emptyCompanyDetails);
  const [branchSettings, setBranchSettings] = useState<BranchSettingsForm>(emptyBranchSettings);
  const [initialBranchSettings, setInitialBranchSettings] = useState<BranchSettingsForm>(emptyBranchSettings);
  const [branchForm, setBranchForm] = useState<BranchEntry>(emptyBranchForm);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [showEditBranchForm, setShowEditBranchForm] = useState(false);
  const [selectedBranchToEdit, setSelectedBranchToEdit] = useState<string | null>(null);
  const [branchEditDraft, setBranchEditDraft] = useState<BranchEntry>(emptyBranchForm);
  const [branchEditMode, setBranchEditMode] = useState(false);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [branchSearchQuery, setBranchSearchQuery] = useState("");
  const [branchSearchFocused, setBranchSearchFocused] = useState(false);
  const branchEditBlockedToastAtRef = useRef(0);
  const [branchSaving, setBranchSaving] = useState(false);

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordError, setPasswordError] = useState("");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("user");
  const [personaliseLogoLayout, setPersonaliseLogoLayout] = useState<"vertical" | "horizontal" | null>(null);
  const [personaliseLogoPreview, setPersonaliseLogoPreview] = useState("");
  const [initialPersonaliseLogoLayout, setInitialPersonaliseLogoLayout] = useState<"vertical" | "horizontal" | null>(null);
  const [initialPersonaliseLogoPreview, setInitialPersonaliseLogoPreview] = useState("");
  const [personaliseLogoName, setPersonaliseLogoName] = useState("");
  const [isInviteSubuserOpen, setIsInviteSubuserOpen] = useState(false);
  const [subuserInviteForm, setSubuserInviteForm] = useState<SubuserInviteForm>(emptySubuserInviteForm);
  const [subuserInviteSubmitting, setSubuserInviteSubmitting] = useState(false);
  const [subuserInviteStep, setSubuserInviteStep] = useState<1 | 2>(1);
  const [showSubuserPassword, setShowSubuserPassword] = useState(false);
  const [showSubuserConfirmPassword, setShowSubuserConfirmPassword] = useState(false);
  const [subusersList, setSubusersList] = useState<SubuserListItem[]>([]);
  const [subusersLoading, setSubusersLoading] = useState(false);
  const [isBranchAllocationOpen, setIsBranchAllocationOpen] = useState(false);
  const [branchAllocationEmployees, setBranchAllocationEmployees] = useState<BranchAllocationEmployee[]>([]);
  const [branchAllocationLoading, setBranchAllocationLoading] = useState(false);
  const [branchAllocationSubmitting, setBranchAllocationSubmitting] = useState(false);
  const [branchAllocationSearchQuery, setBranchAllocationSearchQuery] = useState("");
  const [branchAllocationSearchFocused, setBranchAllocationSearchFocused] = useState(false);
  const [branchAllocationSelectedBranch, setBranchAllocationSelectedBranch] = useState("");
  const [branchAllocationSelectedEmployeeIds, setBranchAllocationSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [selectedAllocatedBranchToEdit, setSelectedAllocatedBranchToEdit] = useState<string | null>(null);
  const [isAllocatedBranchEmployeesOpen, setIsAllocatedBranchEmployeesOpen] = useState(false);
  const [allocatedBranchEmployeesSearchQuery, setAllocatedBranchEmployeesSearchQuery] = useState("");
  const [allocatedBranchEmployeesSearchFocused, setAllocatedBranchEmployeesSearchFocused] = useState(false);
  const [allocatedBranchSelectedEmployeeIds, setAllocatedBranchSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [allocatedBranchRemoveSubmitting, setAllocatedBranchRemoveSubmitting] = useState(false);
  const [allocatedBranches, setAllocatedBranches] = useState<string[]>([]);
  const [allocatedBranchSearchQuery, setAllocatedBranchSearchQuery] = useState("");
  const [allocatedBranchSearchFocused, setAllocatedBranchSearchFocused] = useState(false);
  const [tabLoading, setTabLoading] = useState<Record<SettingsTab, boolean>>(emptyTabLoadingState);
  const loadedGroupsRef = useRef<Set<ProfileDataGroup>>(new Set());
  const loadingGroupsRef = useRef<Set<ProfileDataGroup>>(new Set());
  const personaliseLogoInputRef = useRef<HTMLInputElement | null>(null);

  const settingsTabs: Array<{ value: SettingsTab; label: string; icon: LucideIcon }> = [
    { value: "user", label: "User Details", icon: User },
    { value: "subusers", label: "Subusers", icon: Users },
    { value: "company", label: "Company Profile", icon: Building2 },
    { value: "companyAddress", label: "Company Address", icon: MapPin },
    { value: "companySetup", label: "Company Setup", icon: SlidersHorizontal },
    { value: "auth", label: "Authentication", icon: Lock },
    { value: "personalize", label: "Personalise", icon: Palette },
  ];
  const popupActionButtonClass =
    "h-8 min-w-[108px] rounded px-3 text-[11px] inline-flex items-center justify-center border border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-blue-600";
  const companyProfileReadOnlyInputClass =
    "bg-slate-100 text-slate-700 pointer-events-none cursor-default hover:border-slate-400 focus-visible:border-slate-400";
  const subuserModalInputClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !h-[34px] !border-[0.5px] !border-slate-400 !focus-visible:border-slate-300";
  const floatingLabelClass =
    "pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold leading-none text-slate-400";
  const settingsActionRowClass = "mt-auto flex justify-center border-t border-slate-100 bg-white pt-3 pb-1";
  const isSubuserStepOneComplete =
    subuserInviteForm.name.trim().length > 0 &&
    subuserInviteForm.surname.trim().length > 0 &&
    subuserInviteForm.contact_number.trim().length > 0 &&
    subuserInviteForm.email.trim().length > 0 &&
    subuserInviteForm.role.trim().length > 0;
  const isSubuserStepTwoComplete =
    subuserInviteForm.username.trim().length > 0 &&
    subuserInviteForm.password.trim().length > 0 &&
    subuserInviteForm.confirmPassword.trim().length > 0 &&
    subuserInviteForm.password === subuserInviteForm.confirmPassword;
  const branchNames = useMemo(
    () =>
      branchSettings.branches
        .map((item) => item.name.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [branchSettings.branches],
  );
  const branchAllocationFilteredEmployees = useMemo(() => {
    const query = branchAllocationSearchQuery.trim().toLowerCase();
    const normalizedBranchNames = branchNames.map((name) => name.trim().toLowerCase()).filter(Boolean);
    return branchAllocationEmployees.filter((employee) => {
      const assignedBranches = new Set(employee.branchNames.map((name) => name.trim().toLowerCase()).filter(Boolean));
      const isAllocatedToAllBranches =
        normalizedBranchNames.length > 0 && normalizedBranchNames.every((name) => assignedBranches.has(name));
      if (isAllocatedToAllBranches) return false;
      if (!query) return true;
      const fullName = `${employee.employee_name} ${employee.employee_surname}`.trim().toLowerCase();
      return (
        fullName.includes(query) ||
        employee.id_number.toLowerCase().includes(query)
      );
    });
  }, [branchAllocationEmployees, branchAllocationSearchQuery, branchNames]);
  const branchAllocationSelectedEmployees = useMemo(
    () =>
      branchAllocationEmployees
        .filter((employee) => branchAllocationSelectedEmployeeIds.has(employee.id))
        .sort((a, b) =>
          `${a.employee_surname} ${a.employee_name}`.localeCompare(`${b.employee_surname} ${b.employee_name}`),
        ),
    [branchAllocationEmployees, branchAllocationSelectedEmployeeIds],
  );
  const branchAllocationPendingChanges = useMemo(() => {
    const selectedBranchNormalized = branchAllocationSelectedBranch.trim().toLowerCase();
    if (!selectedBranchNormalized) {
      return {
        employeeIdsToAssign: [] as string[],
        totalChanges: 0,
      };
    }

    const selectedEmployeeIds = Array.from(branchAllocationSelectedEmployeeIds);
    const currentlyAssignedToSelectedBranch = new Set(
      branchAllocationEmployees
        .filter((employee) => employeeHasBranch(employee, selectedBranchNormalized))
        .map((employee) => employee.id),
    );
    const employeeIdsToAssign = selectedEmployeeIds.filter((employeeId) => !currentlyAssignedToSelectedBranch.has(employeeId));
    return {
      employeeIdsToAssign,
      totalChanges: employeeIdsToAssign.length,
    };
  }, [
    branchAllocationEmployees,
    branchAllocationSelectedBranch,
    branchAllocationSelectedEmployeeIds,
  ]);
  const filteredAllocatedBranches = useMemo(
    () => {
      const query = allocatedBranchSearchQuery.trim().toLowerCase();
      if (!query) return allocatedBranches;

      const branchNameMatches = allocatedBranches.filter((value) =>
        value.toLowerCase().includes(query),
      );

      const employeeMatchedBranchNames = new Set<string>();
      for (const employee of branchAllocationEmployees) {
        const fullName = `${employee.employee_name} ${employee.employee_surname}`.trim().toLowerCase();
        const idNumber = employee.id_number.toLowerCase();
        const matchesEmployee = fullName.includes(query) || idNumber.includes(query);
        if (!matchesEmployee) continue;
        for (const branchName of employee.branchNames) {
          employeeMatchedBranchNames.add(branchName.toLowerCase());
        }
      }

      const allMatches = new Set<string>([
        ...branchNameMatches.map((value) => value.toLowerCase()),
        ...employeeMatchedBranchNames,
      ]);

      return allocatedBranches.filter((value) => allMatches.has(value.toLowerCase()));
    },
    [allocatedBranchSearchQuery, allocatedBranches, branchAllocationEmployees],
  );
  const filteredAllocatedBranchEmployees = useMemo(() => {
    const selectedBranchNormalized = selectedAllocatedBranchToEdit?.trim().toLowerCase() ?? "";
    if (!selectedBranchNormalized) return [];
    const query = allocatedBranchEmployeesSearchQuery.trim().toLowerCase();
    return branchAllocationEmployees
      .filter((employee) => employeeHasBranch(employee, selectedBranchNormalized))
      .filter((employee) => {
        if (!query) return true;
        const fullName = `${employee.employee_name} ${employee.employee_surname}`.trim().toLowerCase();
        return fullName.includes(query) || employee.id_number.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const aName = `${a.employee_surname} ${a.employee_name}`.trim().toLowerCase();
        const bName = `${b.employee_surname} ${b.employee_name}`.trim().toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [allocatedBranchEmployeesSearchQuery, branchAllocationEmployees, selectedAllocatedBranchToEdit]);

  const setGroupLoading = useCallback((group: ProfileDataGroup, value: boolean) => {
    setTabLoading((prev) => {
      const next = { ...prev };
      for (const tab of profileGroupToTabs[group]) {
        next[tab] = value;
      }
      return next;
    });
  }, []);

  const applyCachedData = useCallback((cached: SettingsProfileCache | undefined) => {
    if (!cached) return;
    if (cached.userDetails) {
      setUserDetails(cached.userDetails);
      setInitialUserDetails(cached.userDetails);
    }
    if (cached.companyDetails) {
      setCompanyDetails(cached.companyDetails);
      setInitialCompanyDetails(cached.companyDetails);
    }
    if (cached.branchSettings) {
      setBranchSettings(cached.branchSettings);
      setInitialBranchSettings(cached.branchSettings);
    }
    if (cached.personalise) {
      setPersonaliseLogoPreview(cached.personalise.preview);
      setInitialPersonaliseLogoPreview(cached.personalise.preview);
      setPersonaliseLogoLayout(cached.personalise.layout);
      setInitialPersonaliseLogoLayout(cached.personalise.layout);
    }
  }, []);

  const ensureTabDataLoaded = useCallback(async (tab: SettingsTab) => {
    if (!user) return;
    const group = tabToProfileGroup[tab];
    if (!group) return;

    const cached = settingsProfileCacheByUser.get(user.id);
    if (cached?.loadedGroups.has(group) || loadedGroupsRef.current.has(group)) return;
    if (loadingGroupsRef.current.has(group)) return;

    loadingGroupsRef.current.add(group);
    setGroupLoading(group, true);

    try {
      if (group === "user") {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_name, user_surname, user_email, user_contact")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const nextUserDetails: UserDetailsForm = {
          user_name: data.user_name || "",
          user_surname: data.user_surname || "",
          user_email: data.user_email || "",
          user_contact: data.user_contact || "",
        };

        setUserDetails(nextUserDetails);
        setInitialUserDetails(nextUserDetails);
        const nextCache = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
        nextCache.userDetails = nextUserDetails;
        nextCache.loadedGroups.add(group);
        settingsProfileCacheByUser.set(user.id, nextCache);
        loadedGroupsRef.current.add(group);
        return;
      }

      if (group === "company") {
        const { data, error } = await supabase
          .from("profiles")
          .select("company_type, company_name, registration_number, vat_number, physical_address, postal_address, representative_name, representative_surname, company_contact, company_email")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const physicalAddress = data.physical_address
          ? parseAddressParts(data.physical_address)
          : {
              physical_address_line1: DEFAULT_PHYSICAL_ADDRESS_LINE1,
              physical_address_line2: DEFAULT_PHYSICAL_ADDRESS_LINE2,
              city: DEFAULT_CITY,
              province: DEFAULT_PROVINCE,
              area_code: DEFAULT_AREA_CODE,
            };
        const postalAddress = data.postal_address
          ? parsePostalAddressParts(data.postal_address)
          : {
              postal_address_line1: physicalAddress.physical_address_line1,
              postal_address_line2: physicalAddress.physical_address_line2,
              postal_city: physicalAddress.city,
              postal_province: physicalAddress.province,
              postal_area_code: physicalAddress.area_code,
            };
        const nextCompanyDetails: CompanyDetailsForm = {
          company_type: DEFAULT_TRADING_AS,
          company_name: DEFAULT_COMPANY_NAME,
          registration_number: DEFAULT_REGISTRATION_NUMBER,
          vat_number: DEFAULT_VAT_NUMBER,
          ...physicalAddress,
          ...postalAddress,
          representative_name: DEFAULT_REPRESENTATIVE_NAME,
          representative_surname: DEFAULT_REPRESENTATIVE_SURNAME,
          company_contact: DEFAULT_COMPANY_CONTACT,
          company_email: DEFAULT_COMPANY_EMAIL,
        };

        setCompanyDetails(nextCompanyDetails);
        setInitialCompanyDetails(nextCompanyDetails);
        const nextCache = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
        nextCache.companyDetails = nextCompanyDetails;
        nextCache.loadedGroups.add(group);
        settingsProfileCacheByUser.set(user.id, nextCache);
        loadedGroupsRef.current.add(group);
        return;
      }

      if (group === "branches") {
        const [{ data: profileData, error: profileError }, { data: branchRows, error: branchError }] = await Promise.all([
          supabase
            .from("profiles")
            .select("branches_enabled, branches")
            .eq("id", user.id)
            .maybeSingle(),
          (supabase as any)
            .from("branches")
            .select("name, address_line1, address_line2, city, province, area_code")
            .eq("company_id", user.id)
            .order("name", { ascending: true }),
        ]);

        if (profileError) throw profileError;
        if (!profileData) return;
        if (branchError) {
          const message = String((branchError as { message?: string } | null)?.message || "").toLowerCase();
          const isTableMissing = message.includes("relation") && message.includes("branches");
          if (!isTableMissing) throw branchError;
        }

        const branchesFromTable: BranchEntry[] = Array.isArray(branchRows)
          ? branchRows
              .map((item: any) => ({
                name: String(item?.name ?? "").trim(),
                address_line1: String(item?.address_line1 ?? "").trim(),
                address_line2: String(item?.address_line2 ?? "").trim(),
                city: String(item?.city ?? "").trim(),
                province: String(item?.province ?? "").trim(),
                area_code: String(item?.area_code ?? "").trim(),
              }))
              .filter((item) => item.name.length > 0)
          : [];

        const nextBranchSettings: BranchSettingsForm = {
          branches_enabled: Boolean(profileData.branches_enabled),
          branches: branchesFromTable.length > 0 ? branchesFromTable : parseBranchValues(profileData.branches),
        };

        setBranchSettings(nextBranchSettings);
        setInitialBranchSettings(nextBranchSettings);
        const nextCache = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
        nextCache.branchSettings = nextBranchSettings;
        nextCache.loadedGroups.add(group);
        settingsProfileCacheByUser.set(user.id, nextCache);
        loadedGroupsRef.current.add(group);
        return;
      }

      if (group === "personalize") {
        if (personalizeColumnsSupported === false) {
          loadedGroupsRef.current.add(group);
          const nextCache = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
          nextCache.loadedGroups.add(group);
          settingsProfileCacheByUser.set(user.id, nextCache);
          return;
        }

        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("company_logo_data_url, company_logo_layout")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          if (isPersonalizeColumnError(error)) {
            personalizeColumnsSupported = false;
            loadedGroupsRef.current.add(group);
            const nextCache = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
            nextCache.loadedGroups.add(group);
            settingsProfileCacheByUser.set(user.id, nextCache);
            return;
          }
          throw error;
        }

        personalizeColumnsSupported = true;
        const preview = (((data as any)?.company_logo_data_url ?? "") as string).trim();
        const rawLayout = (((data as any)?.company_logo_layout ?? "") as string).trim().toLowerCase();
        const layout = rawLayout === "vertical" || rawLayout === "horizontal" ? rawLayout : null;

        setPersonaliseLogoPreview(preview);
        setInitialPersonaliseLogoPreview(preview);
        setPersonaliseLogoLayout(layout);
        setInitialPersonaliseLogoLayout(layout);
        const nextCache = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
        nextCache.personalise = { preview, layout };
        nextCache.loadedGroups.add(group);
        settingsProfileCacheByUser.set(user.id, nextCache);
        loadedGroupsRef.current.add(group);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      loadingGroupsRef.current.delete(group);
      setGroupLoading(group, false);
    }
  }, [setGroupLoading, toast, user]);

  useEffect(() => {
    if (!user) return;

    const cached = settingsProfileCacheByUser.get(user.id);
    if (cached) {
      loadedGroupsRef.current = new Set(cached.loadedGroups);
      applyCachedData(cached);
    } else {
      loadedGroupsRef.current = new Set();
    }

    void ensureTabDataLoaded("user");

    const backgroundTabs = allSettingsTabs.filter((tab) => tab !== "user");
    const timer = window.setTimeout(() => {
      for (const tab of backgroundTabs) {
        void ensureTabDataLoaded(tab);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [applyCachedData, ensureTabDataLoaded, user]);

  useEffect(() => {
    if (!user) return;
    void ensureTabDataLoaded(settingsTab);
  }, [ensureTabDataLoaded, settingsTab, user]);

  const persistBranchSettings = useCallback(
    async (nextEnabled: boolean, nextBranches: BranchEntry[]) => {
      if (!user) return false;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          branches_enabled: nextEnabled,
        })
        .eq("id", user.id);

      if (profileError) {
        toast({
          title: "Error",
          description: getSafeErrorMessage(profileError),
          variant: "destructive",
        });
        return false;
      }

      const { error: deleteBranchesError } = await (supabase as any)
        .from("branches")
        .delete()
        .eq("company_id", user.id);

      if (deleteBranchesError) {
        toast({
          title: "Error",
          description: getSafeErrorMessage(deleteBranchesError),
          variant: "destructive",
        });
        return false;
      }

      if (nextBranches.length > 0) {
        const branchPayload = nextBranches.map((branch) => ({
          company_id: user.id,
          name: branch.name,
          address_line1: branch.address_line1,
          address_line2: branch.address_line2,
          city: branch.city,
          province: branch.province,
          area_code: branch.area_code,
        }));
        const { error: insertBranchesError } = await (supabase as any)
          .from("branches")
          .insert(branchPayload);
        if (insertBranchesError) {
          toast({
            title: "Error",
            description: getSafeErrorMessage(insertBranchesError),
            variant: "destructive",
          });
          return false;
        }
      }

      return true;
    },
    [toast, user],
  );

  const applyLocalBranchSettings = useCallback(
    (nextEnabled: boolean, nextBranches: BranchEntry[]) => {
      const nextSettings: BranchSettingsForm = {
        branches_enabled: nextEnabled,
        branches: nextBranches,
      };
      setBranchSettings(nextSettings);
      setInitialBranchSettings(nextSettings);
      if (!user) return;
      const cached = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
      cached.branchSettings = nextSettings;
      cached.loadedGroups.add("branches");
      settingsProfileCacheByUser.set(user.id, cached);
    },
    [user],
  );

  const handleAddBranch = async (sourceBranchForm?: BranchEntry) => {
    const source = sourceBranchForm ?? branchForm;
    const normalizedName = source.name.trim().replace(/\s+/g, " ");
    if (!normalizedName) return false;
    const normalizedAddressLine1 = source.address_line1.trim();
    const normalizedCity = source.city.trim();
    const normalizedProvince = source.province.trim();
    const normalizedAreaCode = source.area_code.trim();
    if (!normalizedAddressLine1 || !normalizedCity || !normalizedProvince || !normalizedAreaCode) {
      toast({
        title: "Missing required fields",
        description: "Address line 1, city, province, and area code are required.",
        variant: "destructive",
      });
      return false;
    }
    const duplicateExists = branchSettings.branches.some(
      (value) => value.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (duplicateExists) {
      toast({
        title: "Branch already exists",
        description: "Please add a unique branch name.",
        variant: "destructive",
      });
      return false;
    }

    const nextBranches = [
      ...branchSettings.branches,
      {
        name: normalizedName,
        address_line1: normalizedAddressLine1,
        address_line2: source.address_line2.trim(),
        city: normalizedCity,
        province: normalizedProvince,
        area_code: normalizedAreaCode,
      },
    ];

    setBranchSaving(true);
    const persisted = await persistBranchSettings(branchSettings.branches_enabled, nextBranches);
    setBranchSaving(false);
    if (!persisted) return false;

    applyLocalBranchSettings(branchSettings.branches_enabled, nextBranches);
    setBranchForm(emptyBranchForm);
    return true;
  };

  const handleRemoveBranch = async (branchNameToRemove: string) => {
    const confirmed = confirm(
      `Are you sure you want to delete "${branchNameToRemove}"?`,
    );
    if (!confirmed) return;

    const nextBranches = branchSettings.branches.filter((value) => value.name !== branchNameToRemove);
    setBranchSaving(true);
    const persisted = await persistBranchSettings(branchSettings.branches_enabled, nextBranches);
    setBranchSaving(false);
    if (!persisted) return;

    applyLocalBranchSettings(branchSettings.branches_enabled, nextBranches);

    if (selectedBranchName === branchNameToRemove) {
      setSelectedBranchName(null);
      setBranchForm(emptyBranchForm);
    }
  };

  const handleCancelBranchAction = () => {
    setShowBranchForm(false);
    setBranchEditMode(false);
    setSelectedBranchName(null);
    setSelectedBranchToEdit(null);
    setBranchEditDraft(emptyBranchForm);
    setShowEditBranchForm(false);
    setBranchForm(emptyBranchForm);
  };

  const handleOpenEditBranchModal = () => {
    setBranchEditMode(true);
    setSelectedBranchName(null);
    setShowBranchForm(false);
    setSelectedBranchToEdit(null);
    setBranchEditDraft(emptyBranchForm);
    setShowEditBranchForm(false);
  };

  const handleSelectBranchForEdit = (branchName: string) => {
    const branch = branchSettings.branches.find((item) => item.name === branchName);
    if (!branch) return;
    setShowBranchForm(false);
    setSelectedBranchToEdit(branch.name);
    setBranchEditDraft({
      name: branch.name,
      address_line1: branch.address_line1,
      address_line2: branch.address_line2,
      city: branch.city,
      province: branch.province,
      area_code: branch.area_code,
    });
    setShowEditBranchForm(true);
  };

  const handleApplyBranchEdit = async () => {
    if (!selectedBranchToEdit) return;
    const originalName = selectedBranchToEdit.trim();
    const normalizedName = branchEditDraft.name.trim().replace(/\s+/g, " ");
    const normalizedAddressLine1 = branchEditDraft.address_line1.trim();
    const normalizedCity = branchEditDraft.city.trim();
    const normalizedProvince = branchEditDraft.province.trim();
    const normalizedAreaCode = branchEditDraft.area_code.trim();
    if (!normalizedName) {
      toast({
        title: "Missing branch name",
        description: "Branch name is required.",
        variant: "destructive",
      });
      return;
    }
    if (!normalizedAddressLine1 || !normalizedCity || !normalizedProvince || !normalizedAreaCode) {
      toast({
        title: "Missing required fields",
        description: "Address line 1, city, province, and area code are required.",
        variant: "destructive",
      });
      return;
    }

    const duplicateExists = branchSettings.branches.some(
      (item) =>
        item.name.trim().toLowerCase() === normalizedName.toLowerCase() &&
        item.name.trim().toLowerCase() !== originalName.toLowerCase(),
    );
    if (duplicateExists) {
      toast({
        title: "Branch already exists",
        description: "Please use a unique branch name.",
        variant: "destructive",
      });
      return;
    }

    const nextBranches = branchSettings.branches.map((item) => {
      if (item.name !== originalName) return item;
      return {
        name: normalizedName,
        address_line1: normalizedAddressLine1,
        address_line2: branchEditDraft.address_line2.trim(),
        city: normalizedCity,
        province: normalizedProvince,
        area_code: normalizedAreaCode,
      };
    });

    setBranchSaving(true);
    const persisted = await persistBranchSettings(branchSettings.branches_enabled, nextBranches);
    setBranchSaving(false);
    if (!persisted) return;

    applyLocalBranchSettings(branchSettings.branches_enabled, nextBranches);

    setShowEditBranchForm(false);
    setBranchEditMode(false);
    setSelectedBranchToEdit(null);
    setBranchEditDraft(emptyBranchForm);

    if (selectedBranchName && selectedBranchName === originalName) {
      const updatedSelected = nextBranches.find((item) => item.name === normalizedName) ?? null;
      setSelectedBranchName(updatedSelected?.name ?? null);
      setBranchForm(updatedSelected ?? emptyBranchForm);
    }
  };

  const handleBranchSettingsUpdate = async () => {
    if (!user) return;
    setBranchSaving(true);

    const selectedNameNormalized = selectedBranchName?.trim().toLowerCase() ?? "";
    let branchSource = [...branchSettings.branches];
    const normalizedFormName = branchForm.name.trim().replace(/\s+/g, " ");

    if (branchSettings.branches_enabled && branchEditMode && selectedNameNormalized) {
      if (!normalizedFormName) {
        toast({
          title: "Missing branch name",
          description: "Branch name is required.",
          variant: "destructive",
        });
        setBranchSaving(false);
        return;
      }
      const renameDuplicate = branchSource.some(
        (item) =>
          item.name.trim().toLowerCase() === normalizedFormName.toLowerCase() &&
          item.name.trim().toLowerCase() !== selectedNameNormalized,
      );
      if (renameDuplicate) {
        toast({
          title: "Branch already exists",
          description: "Please use a unique branch name.",
          variant: "destructive",
        });
        setBranchSaving(false);
        return;
      }

      branchSource = branchSource.map((item) => {
        if (item.name.trim().toLowerCase() !== selectedNameNormalized) return item;
        return {
          name: normalizedFormName,
          address_line1: branchForm.address_line1.trim(),
          address_line2: branchForm.address_line2.trim(),
          city: branchForm.city.trim(),
          province: branchForm.province.trim(),
          area_code: branchForm.area_code.trim(),
        };
      });
    }

    const cleanedBranches = branchSource.reduce<BranchEntry[]>((acc, branch) => {
      const normalizedName = branch.name.trim().replace(/\s+/g, " ");
      if (!normalizedName) return acc;
      const duplicate = acc.some((item) => item.name.toLowerCase() === normalizedName.toLowerCase());
      if (duplicate) return acc;
      acc.push({
        name: normalizedName,
        address_line1: branch.address_line1.trim(),
        address_line2: branch.address_line2.trim(),
        city: branch.city.trim(),
        province: branch.province.trim(),
        area_code: branch.area_code.trim(),
      });
      return acc;
    }, []);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        branches_enabled: branchSettings.branches_enabled,
      })
      .eq("id", user.id);

    if (profileError) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(profileError),
        variant: "destructive",
      });
      setBranchSaving(false);
      return;
    }

    const { error: deleteBranchesError } = await (supabase as any)
      .from("branches")
      .delete()
      .eq("company_id", user.id);

    if (deleteBranchesError) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(deleteBranchesError),
        variant: "destructive",
      });
      setBranchSaving(false);
      return;
    }

    if (cleanedBranches.length > 0) {
      const branchPayload = cleanedBranches.map((branch) => ({
        company_id: user.id,
        name: branch.name,
        address_line1: branch.address_line1,
        address_line2: branch.address_line2,
        city: branch.city,
        province: branch.province,
        area_code: branch.area_code,
      }));
      const { error: insertBranchesError } = await (supabase as any)
        .from("branches")
        .insert(branchPayload);
      if (insertBranchesError) {
        toast({
          title: "Error",
          description: getSafeErrorMessage(insertBranchesError),
          variant: "destructive",
        });
        setBranchSaving(false);
        return;
      }
    }

    setBranchSettings((prev) => ({
      ...prev,
      branches: cleanedBranches,
    }));
    setInitialBranchSettings({
      branches_enabled: branchSettings.branches_enabled,
      branches: cleanedBranches,
    });
    const cached = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
    cached.branchSettings = {
      branches_enabled: branchSettings.branches_enabled,
      branches: cleanedBranches,
    };
    cached.loadedGroups.add("branches");
    settingsProfileCacheByUser.set(user.id, cached);
    if (branchEditMode && selectedNameNormalized) {
      const updatedSelected =
        cleanedBranches.find((item) => item.name.trim().toLowerCase() === normalizedFormName.toLowerCase()) ??
        null;
      setSelectedBranchName(updatedSelected?.name ?? null);
      setBranchForm(updatedSelected ?? emptyBranchForm);
    }
    toast({
      title: "Success",
      description: "Branch settings updated successfully",
    });

    setBranchSaving(false);
  };

  const handleUserDetailsUpdate = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Validate user fields using existing schema
      const validated = companySetupBaseSchema.pick({
        userName: true,
        userSurname: true,
        userEmail: true,
        userContact: true
      }).parse({
        userName: userDetails.user_name,
        userSurname: userDetails.user_surname,
        userEmail: userDetails.user_email,
        userContact: userDetails.user_contact
      });
      
      // Update with validated data
      const { error } = await supabase
        .from("profiles")
        .update({
          user_name: validated.userName,
          user_surname: validated.userSurname,
          user_email: validated.userEmail,
          user_contact: validated.userContact
        })
        .eq("id", user.id);

      if (error) throw error;

      setInitialUserDetails({
        user_name: validated.userName,
        user_surname: validated.userSurname,
        user_email: validated.userEmail,
        user_contact: validated.userContact,
      });
      const cached = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
      cached.userDetails = {
        user_name: validated.userName,
        user_surname: validated.userSurname,
        user_email: validated.userEmail,
        user_contact: validated.userContact,
      };
      cached.loadedGroups.add("user");
      settingsProfileCacheByUser.set(user.id, cached);

      toast({
        title: "Success",
        description: "User details updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCompanyDetailsUpdate = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const postalAddress = [
        companyDetails.postal_address_line1,
        companyDetails.postal_address_line2,
        companyDetails.postal_city,
        companyDetails.postal_province,
        companyDetails.postal_area_code,
      ].filter(Boolean).join(", ");

      const validated = companySetupBaseSchema.parse({
        physicalAddressLine1: companyDetails.physical_address_line1,
        physicalAddressLine2: companyDetails.physical_address_line2,
        city: companyDetails.city,
        province: companyDetails.province,
        areaCode: companyDetails.area_code,
        postalAddress: postalAddress,
        companyContact: DEFAULT_COMPANY_CONTACT,
        companyEmail: DEFAULT_COMPANY_EMAIL,
        userName: DEFAULT_REPRESENTATIVE_NAME,
        userSurname: DEFAULT_REPRESENTATIVE_SURNAME,
        userContact: DEFAULT_COMPANY_CONTACT,
        userEmail: DEFAULT_COMPANY_EMAIL,
      });

      const physicalAddress = [
        validated.physicalAddressLine1,
        validated.physicalAddressLine2,
        validated.city,
        validated.province,
        validated.areaCode,
      ].filter(Boolean).join(", ");

      const { error } = await supabase
        .from("profiles")
        .update({
          company_type: DEFAULT_TRADING_AS,
          company_name: DEFAULT_COMPANY_NAME,
          registration_number: DEFAULT_REGISTRATION_NUMBER,
          vat_number: DEFAULT_VAT_NUMBER,
          physical_address: physicalAddress,
          postal_address: validated.postalAddress || "",
          representative_name: DEFAULT_REPRESENTATIVE_NAME,
          representative_surname: DEFAULT_REPRESENTATIVE_SURNAME,
          company_contact: validated.companyContact,
          company_email: validated.companyEmail,
        })
        .eq("id", user.id);

      if (error) throw error;

      const nextCompanyDetails: CompanyDetailsForm = {
        ...companyDetails,
        company_type: DEFAULT_TRADING_AS,
        company_name: DEFAULT_COMPANY_NAME,
        registration_number: DEFAULT_REGISTRATION_NUMBER,
        vat_number: DEFAULT_VAT_NUMBER,
        representative_name: DEFAULT_REPRESENTATIVE_NAME,
        representative_surname: DEFAULT_REPRESENTATIVE_SURNAME,
        company_contact: DEFAULT_COMPANY_CONTACT,
        company_email: DEFAULT_COMPANY_EMAIL,
      };
      setCompanyDetails(nextCompanyDetails);
      setInitialCompanyDetails(nextCompanyDetails);
      const cached = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
      cached.companyDetails = nextCompanyDetails;
      cached.loadedGroups.add("company");
      settingsProfileCacheByUser.set(user.id, cached);

      toast({
        title: "Success",
        description: "Company details updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    setPasswordError("");
    
    try {
      passwordSchema.parse(passwordData.newPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setPasswordError(error.errors[0].message);
        return;
      }
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword,
    });

    if (error) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setPasswordData({ newPassword: "", confirmPassword: "" });
    }
    setSaving(false);
  };

  const cropPersonaliseLogoPadding = (dataUrl: string): Promise<string> =>
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

  const detectPersonaliseLogoLayout = (
    dataUrl: string,
  ): Promise<"vertical" | "horizontal" | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(null);
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(img, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const rowInk = new Array<number>(height).fill(0);
        const colInk = new Array<number>(width).fill(0);

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];
            const isTransparent = a < 18;
            const isNearWhite = r > 246 && g > 246 && b > 246;
            if (isTransparent || isNearWhite) continue;
            rowInk[y] += 1;
            colInk[x] += 1;
          }
        }

        const scoreSplitStructure = (series: number[]) => {
          const n = series.length;
          if (n < 10) return 0;
          const maxInk = Math.max(...series);
          if (maxInk <= 0) return 0;

          const minSplit = Math.floor(n * 0.28);
          const maxSplit = Math.ceil(n * 0.72);
          const valleyWindow = Math.max(1, Math.floor(n * 0.02));
          let best = 0;

          for (let split = minSplit; split <= maxSplit; split++) {
            const leftPeak = Math.max(...series.slice(0, split));
            const rightPeak = Math.max(...series.slice(split));
            if (leftPeak <= 0 || rightPeak <= 0) continue;
            const valleyStart = Math.max(0, split - valleyWindow);
            const valleyEnd = Math.min(n, split + valleyWindow + 1);
            const valley = Math.min(...series.slice(valleyStart, valleyEnd));
            const raw = Math.min(leftPeak, rightPeak) - valley;
            if (raw > best) best = raw;
          }

          return best / maxInk;
        };

        const verticalStackScore = scoreSplitStructure(rowInk); // icon above text
        const horizontalSideScore = scoreSplitStructure(colInk); // icon beside text

        const rowStartTop = 0;
        const rowEndTop = Math.max(1, Math.floor(height * 0.45));
        const rowStartBottom = Math.min(height - 1, Math.floor(height * 0.55));
        const rowEndBottom = height;
        const spanRatioForRows = (startRow: number, endRow: number) => {
          let minX = width;
          let maxX = -1;
          for (let y = startRow; y < endRow; y++) {
            for (let x = 0; x < width; x++) {
              const idx = (y * width + x) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];
              const a = pixels[idx + 3];
              const isTransparent = a < 18;
              const isNearWhite = r > 246 && g > 246 && b > 246;
              if (isTransparent || isNearWhite) continue;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
            }
          }
          if (maxX < minX) return 0;
          return (maxX - minX + 1) / width;
        };
        const topSpanRatio = spanRatioForRows(rowStartTop, rowEndTop);
        const bottomSpanRatio = spanRatioForRows(rowStartBottom, rowEndBottom);
        const bottomMuchWiderThanTop = bottomSpanRatio > topSpanRatio + 0.18;
        const aspectRatio = width / height;

        if (
          horizontalSideScore >= 0.28 &&
          horizontalSideScore > verticalStackScore * 1.45 &&
          !bottomMuchWiderThanTop
        ) {
          resolve("horizontal");
          return;
        }

        if (
          (verticalStackScore >= 0.2 &&
            verticalStackScore > horizontalSideScore * 1.15) ||
          (bottomMuchWiderThanTop && verticalStackScore >= 0.12)
        ) {
          resolve("vertical");
          return;
        }

        // Fallback: if structural confidence is borderline, use cleaned aspect ratio.
        // This catches wide/tall logos that don't present a strong split signal.
        if (
          aspectRatio >= 1.2 &&
          horizontalSideScore >= verticalStackScore * 0.72
        ) {
          resolve("horizontal");
          return;
        }

        if (
          aspectRatio <= 0.84 &&
          verticalStackScore >= horizontalSideScore * 0.72
        ) {
          resolve("vertical");
          return;
        }

        // Very strong ratio bias should still decide, unless strongly contradicted.
        if (aspectRatio >= 1.38 && verticalStackScore < horizontalSideScore * 1.35) {
          resolve("horizontal");
          return;
        }

        if (aspectRatio <= 0.72 && horizontalSideScore < verticalStackScore * 1.35) {
          resolve("vertical");
          return;
        }

        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });

  const handlePersonaliseLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file for your logo.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const maxBytes = 4 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 4MB.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        toast({
          title: "Upload failed",
          description: "We couldn't read this file. Please try another image.",
          variant: "destructive",
        });
        return;
      }
      const cleanedLogo = await cropPersonaliseLogoPadding(result);
      const detectedLayout = await detectPersonaliseLogoLayout(cleanedLogo);
      setPersonaliseLogoPreview(cleanedLogo);
      setPersonaliseLogoName(selectedFile.name);
      if (detectedLayout) {
        setPersonaliseLogoLayout(detectedLayout);
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleRemovePersonaliseLogo = () => {
    setPersonaliseLogoPreview("");
    setPersonaliseLogoName("");
    setPersonaliseLogoLayout(null);
    if (personaliseLogoInputRef.current) {
      personaliseLogoInputRef.current.value = "";
    }
  };

  const handlePersonaliseUpdate = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        company_logo_data_url: personaliseLogoPreview || null,
        company_logo_layout: personaliseLogoLayout || null,
      })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Unable to save personalisation",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } else {
      setInitialPersonaliseLogoPreview(personaliseLogoPreview);
      setInitialPersonaliseLogoLayout(personaliseLogoLayout);
      const cached = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
      cached.personalise = {
        preview: personaliseLogoPreview,
        layout: personaliseLogoLayout,
      };
      cached.loadedGroups.add("personalize");
      settingsProfileCacheByUser.set(user.id, cached);
      toast({
        title: "Success",
        description: "Personalisation settings updated successfully",
      });
    }

    setSaving(false);
  };

  const companyProfileKeys: Array<keyof CompanyDetailsForm> = [
    "company_name",
    "company_type",
    "registration_number",
    "vat_number",
    "company_contact",
    "company_email",
    "representative_name",
    "representative_surname",
  ];

  const companyAddressKeys: Array<keyof CompanyDetailsForm> = [
    "physical_address_line1",
    "physical_address_line2",
    "city",
    "province",
    "area_code",
    "postal_address_line1",
    "postal_address_line2",
    "postal_city",
    "postal_province",
    "postal_area_code",
  ];

  const selectedBranch = selectedBranchName
    ? branchSettings.branches.find((item) => item.name === selectedBranchName) ?? null
    : null;

  const isUserDirty = JSON.stringify(userDetails) !== JSON.stringify(initialUserDetails);
  const isCompanyProfileDirty = companyProfileKeys.some(
    (key) => companyDetails[key] !== initialCompanyDetails[key],
  );
  const isCompanyAddressDirty = companyAddressKeys.some(
    (key) => companyDetails[key] !== initialCompanyDetails[key],
  );
  const isBranchSettingsDirty = JSON.stringify(branchSettings) !== JSON.stringify(initialBranchSettings);
  const isBranchEditDirty =
    branchEditMode &&
    Boolean(selectedBranch) &&
    JSON.stringify(branchForm) !== JSON.stringify(selectedBranch);
  const shouldShowCompanySetupPrimaryAction = isBranchSettingsDirty || isBranchEditDirty;
  const shouldShowAuthAction =
    passwordData.newPassword.trim().length > 0 || passwordData.confirmPassword.trim().length > 0;
  const isPersonaliseDirty =
    personaliseLogoPreview !== initialPersonaliseLogoPreview ||
    personaliseLogoLayout !== initialPersonaliseLogoLayout;
  const isCurrentTabLoading = tabLoading[settingsTab];

  const handleClose = () => {
    if (branchEditMode) {
      handleCancelBranchAction();
    }
    clearAllocatedBranchEditMode();
    if (onClose) {
      onClose();
      return;
    }
    navigate("/dashboard");
  };

  const handleSettingsTabChange = (nextTab: typeof settingsTab) => {
    if (settingsTab === "companySetup" && branchEditMode && nextTab !== "companySetup") {
      handleCancelBranchAction();
    }
    if (settingsTab === "companySetup" && nextTab !== "companySetup") clearAllocatedBranchEditMode();
    setSettingsTab(nextTab);
    void ensureTabDataLoaded(nextTab);
  };

  const handleCompanySetupClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (showEditBranchForm || isAllocatedBranchEmployeesOpen) return;
    if (!branchEditMode) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (branchEditMode && target.closest('[data-branch-edit-allowed="true"]')) return;

    event.preventDefault();
    event.stopPropagation();

    const now = Date.now();
    if (now - branchEditBlockedToastAtRef.current < 1200) return;
    branchEditBlockedToastAtRef.current = now;

    toast({
      title: "Cancel edit mode first",
      description: "Please select Cancel before interacting with other fields.",
    });
  };

  const handleSubuserInviteDialogChange = (open: boolean) => {
    setIsInviteSubuserOpen(open);
    if (!open) {
      setSubuserInviteForm(emptySubuserInviteForm);
      setSubuserInviteSubmitting(false);
      setSubuserInviteStep(1);
      setShowSubuserPassword(false);
      setShowSubuserConfirmPassword(false);
    }
  };
  const fetchSubusersList = useCallback(async () => {
    if (!user?.id) return;
    setSubusersLoading(true);
    try {
      let { data, error } = await (supabase as any)
        .from("subusers")
        .select("id,name,surname,contact_number,email,role,status,created_at")
        .order("created_at", { ascending: false, nullsFirst: false });
      if (error) {
        const code = String((error as any)?.code || "");
        const message = String((error as any)?.message || "").toLowerCase();
        const missingColumn = code === "42703" || message.includes("column");
        if (missingColumn) {
          const fallback = await (supabase as any)
            .from("subusers")
            .select("*")
            .order("created_at", { ascending: false, nullsFirst: false });
          data = fallback.data;
          error = fallback.error;
        }
      }
      if (error) throw error;
      const normalized = ((data ?? []) as any[]).map((row) => ({
        id: String(row.id ?? row.auth_user_id ?? `${row.email ?? "subuser"}-${row.created_at ?? ""}`),
        name: String(row.name ?? row.user_name ?? "").trim(),
        surname: String(row.surname ?? row.user_surname ?? row.last_name ?? "").trim(),
        contact_number: String(row.contact_number ?? row.contact ?? row.phone_number ?? "").trim(),
        email: String(row.email ?? "").trim(),
        role: String(row.role ?? row.user_role ?? "").trim(),
        status: String(row.status ?? "active").trim(),
        created_at: row.created_at ?? row.invited_at ?? null,
      })) as SubuserListItem[];
      setSubusersList(normalized);
    } catch (error: any) {
      toast({
        title: "Unable to load subusers",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      setSubusersList([]);
    } finally {
      setSubusersLoading(false);
    }
  }, [toast, user?.id]);

  const handleSubuserInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (subuserInviteStep === 1) {
      if (!isSubuserStepOneComplete) return;
      setSubuserInviteStep(2);
      return;
    }
    if (!isSubuserStepTwoComplete) return;
    const passwordValidation = passwordSchema.safeParse(subuserInviteForm.password);
    if (!passwordValidation.success) {
      toast({
        title: "Invalid password",
        description: passwordValidation.error.errors[0]?.message ?? "Password does not meet requirements.",
        variant: "destructive",
      });
      return;
    }
    setSubuserInviteSubmitting(true);

    const payload = {
      name: subuserInviteForm.name.trim(),
      surname: subuserInviteForm.surname.trim(),
      contact_number: subuserInviteForm.contact_number.trim(),
      email: subuserInviteForm.email.trim().toLowerCase(),
      role: subuserInviteForm.role,
      username: subuserInviteForm.username.trim(),
      password: subuserInviteForm.password,
    };

    const { data, error } = await supabase.functions.invoke("create-subuser-manual", {
      body: payload,
    });
    const response = (data ?? null) as { ok?: boolean; error?: string; message?: string; email_notification_sent?: boolean } | null;

    if (error) {
      let errorMessage = error.message || "Unable to send invite right now.";
      const errorWithContext = error as { context?: Response };
      if (errorWithContext.context) {
        try {
          const contextBody = await errorWithContext.context.clone().json() as { error?: string; message?: string };
          errorMessage = contextBody.error || contextBody.message || errorMessage;
        } catch {
          try {
            const contextText = await errorWithContext.context.text();
            if (contextText?.trim()) errorMessage = contextText.trim();
          } catch {
            // Keep original message when context payload can't be parsed.
          }
        }
      }
      toast({
        title: "Invite failed",
        description: errorMessage,
        variant: "destructive",
      });
      setSubuserInviteSubmitting(false);
      return;
    }

    if (!response?.ok) {
      toast({
        title: "Invite failed",
        description: response?.error || "Unable to send invite right now.",
        variant: "destructive",
      });
      setSubuserInviteSubmitting(false);
      return;
    }

    toast({
      title: "Subuser created",
      description:
        response?.message ||
        `${payload.name} ${payload.surname} has been created successfully.`,
    });
    await fetchSubusersList();
    handleSubuserInviteDialogChange(false);
  };

  const fetchBranchAllocationEmployees = useCallback(async () => {
    if (!user) return;
    setBranchAllocationLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_name, employee_surname, id_number, branch")
      .eq("company_id", user.id)
      .order("employee_surname", { ascending: true })
      .order("employee_name", { ascending: true });

    if (error) {
      toast({
        title: "Unable to load employees",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      setBranchAllocationEmployees([]);
    } else {
      const nextEmployees: BranchAllocationEmployee[] = (data ?? []).map((item: any) => ({
        id: String(item.id ?? ""),
        employee_name: String(item.employee_name ?? "").trim(),
        employee_surname: String(item.employee_surname ?? "").trim(),
        id_number: String(item.id_number ?? "").trim(),
        branch: String(item.branch ?? "").trim(),
        branchNames: parseEmployeeBranchNames(String(item.branch ?? "").trim()),
      }));
      setBranchAllocationEmployees(nextEmployees);
    }
    setBranchAllocationLoading(false);
  }, [toast, user]);

  const fetchAllocatedBranches = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("employees")
      .select("branch")
      .eq("company_id", user.id)
      .not("branch", "is", null);

    if (error) {
      console.warn("Unable to load allocated branches", error);
      setAllocatedBranches([]);
      return;
    }

    const branchValues: string[] = (data ?? [])
      .flatMap((item: any) => parseEmployeeBranchNames(String(item?.branch ?? "").trim()));
    const uniqueAllocatedBranches: string[] = Array.from(new Set<string>(branchValues)).sort((a, b) =>
      a.localeCompare(b),
    );
    setAllocatedBranches(uniqueAllocatedBranches);
  }, [user]);

  const handleBranchAllocationDialogChange = (open: boolean) => {
    setIsBranchAllocationOpen(open);
    if (!open) {
      setBranchAllocationSearchQuery("");
      setBranchAllocationSearchFocused(false);
      setBranchAllocationSelectedBranch("");
      setBranchAllocationSelectedEmployeeIds(new Set());
      setBranchAllocationSubmitting(false);
      return;
    }
    void fetchBranchAllocationEmployees();
    void fetchAllocatedBranches();
  };

  function clearAllocatedBranchEditMode() {
    setSelectedAllocatedBranchToEdit(null);
    setIsAllocatedBranchEmployeesOpen(false);
    setAllocatedBranchEmployeesSearchQuery("");
    setAllocatedBranchEmployeesSearchFocused(false);
    setAllocatedBranchSelectedEmployeeIds(new Set());
    setAllocatedBranchRemoveSubmitting(false);
  }

  const handleAllocatedBranchEmployeesDialogChange = (open: boolean) => {
    setIsAllocatedBranchEmployeesOpen(open);
    if (!open) {
      setAllocatedBranchEmployeesSearchQuery("");
      setAllocatedBranchEmployeesSearchFocused(false);
      setAllocatedBranchSelectedEmployeeIds(new Set());
      setAllocatedBranchRemoveSubmitting(false);
      return;
    }
    void fetchBranchAllocationEmployees();
  };

  const handleOpenAllocatedBranchEmployees = (branchName: string) => {
    setSelectedAllocatedBranchToEdit(branchName);
    setAllocatedBranchEmployeesSearchQuery("");
    setAllocatedBranchEmployeesSearchFocused(false);
    setAllocatedBranchSelectedEmployeeIds(new Set());
    setAllocatedBranchRemoveSubmitting(false);
    setIsAllocatedBranchEmployeesOpen(true);
    void fetchBranchAllocationEmployees();
  };

  const toggleAllocatedBranchEmployeeSelection = (employeeId: string) => {
    setAllocatedBranchSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const handleRemoveAllocatedBranchEmployees = async () => {
    if (!user) return;
    if (!selectedAllocatedBranchToEdit) return;
    const selectedEmployeeIds = Array.from(allocatedBranchSelectedEmployeeIds);
    if (selectedEmployeeIds.length === 0) return;

    const confirmed = confirm(
      `Are you sure you want to remove ${selectedEmployeeIds.length} employee${
        selectedEmployeeIds.length === 1 ? "" : "s"
      } from "${selectedAllocatedBranchToEdit}"?`,
    );
    if (!confirmed) return;

    setAllocatedBranchRemoveSubmitting(true);
    const selectedBranch = selectedAllocatedBranchToEdit.trim();
    const selectedBranchNormalized = selectedBranch.toLowerCase();
    const selectedEmployees = branchAllocationEmployees.filter((employee) => selectedEmployeeIds.includes(employee.id));
    const updates = selectedEmployees.map(async (employee) => {
      const nextBranches = employee.branchNames.filter((name) => name.toLowerCase() !== selectedBranchNormalized);
      const { error } = await (supabase as any)
        .from("employees")
        .update({ branch: serializeEmployeeBranchNames(nextBranches) } as any)
        .eq("company_id", user.id)
        .eq("id", employee.id);
      return { error };
    });
    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      toast({
        title: "Remove failed",
        description: getSafeErrorMessage(failed.error),
        variant: "destructive",
      });
      setAllocatedBranchRemoveSubmitting(false);
      return;
    }

    toast({
      title: "Employees removed",
      description: `Removed ${selectedEmployeeIds.length} employee${
        selectedEmployeeIds.length === 1 ? "" : "s"
      } from ${selectedAllocatedBranchToEdit}.`,
    });
    clearAllocatedBranchEditMode();
    void fetchBranchAllocationEmployees();
    void fetchAllocatedBranches();
  };

  const toggleBranchAllocationEmployeeSelection = (employeeId: string) => {
    if (!branchAllocationSelectedBranch.trim()) return;
    setBranchAllocationSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const handleBranchAllocationApply = async () => {
    if (!user) return;
    if (!branchAllocationSelectedBranch) return;

    const { employeeIdsToAssign, totalChanges } = branchAllocationPendingChanges;

    if (totalChanges === 0) {
      toast({
        title: "No changes to save",
        description: "There are no branch allocation changes to apply.",
      });
      return;
    }

    const confirmed = confirm(
      `Save branch allocation updates for "${branchAllocationSelectedBranch}"?\n\n` +
      `Assign: ${employeeIdsToAssign.length}`,
    );
    if (!confirmed) return;

    setBranchAllocationSubmitting(true);

    if (employeeIdsToAssign.length > 0) {
      const selectedBranch = branchAllocationSelectedBranch.trim();
      const selectedBranchNormalized = selectedBranch.toLowerCase();
      const selectedEmployees = branchAllocationEmployees.filter((employee) => employeeIdsToAssign.includes(employee.id));
      const updates = selectedEmployees.map(async (employee) => {
        const existing = employee.branchNames;
        const hasBranch = existing.some((name) => name.toLowerCase() === selectedBranchNormalized);
        const nextBranches = hasBranch ? existing : [...existing, selectedBranch];
        const { error } = await supabase
          .from("employees")
          .update({ branch: serializeEmployeeBranchNames(nextBranches) } as any)
          .eq("company_id", user.id)
          .eq("id", employee.id);
        return { error };
      });
      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        toast({
          title: "Save failed",
          description: getSafeErrorMessage(failed.error),
          variant: "destructive",
        });
        setBranchAllocationSubmitting(false);
        return;
      }
    }

    toast({
      title: "Branch allocation saved",
      description: `Assigned ${employeeIdsToAssign.length} employee${employeeIdsToAssign.length === 1 ? "" : "s"} to ${branchAllocationSelectedBranch}.`,
    });
    setBranchAllocationSelectedEmployeeIds(new Set());
    setBranchAllocationSearchQuery("");
    void fetchBranchAllocationEmployees();
    void fetchAllocatedBranches();
    setBranchAllocationSubmitting(false);
    setIsBranchAllocationOpen(false);
  };

  useEffect(() => {
    if (!user) return;
    if (settingsTab !== "companySetup") return;
    if (!branchSettings.branches_enabled) return;
    void fetchAllocatedBranches();
    void fetchBranchAllocationEmployees();
  }, [branchSettings.branches_enabled, fetchAllocatedBranches, fetchBranchAllocationEmployees, settingsTab, user]);
  useEffect(() => {
    if (!user) return;
    if (settingsTab !== "subusers") return;
    void fetchSubusersList();
  }, [fetchSubusersList, settingsTab, user]);

  const content = (
      <div className={embedded ? "h-full w-full p-0" : "h-[calc(100dvh-var(--app-header-height,5rem)-2rem)] px-4 py-4"}>
        <div className={`mx-auto flex h-full w-full ${embedded ? "rounded-sm border-0 bg-white !shadow-none" : "max-w-[980px] rounded-sm border border-slate-300 bg-white shadow-sm"} flex-col overflow-hidden`}>
          <header className="flex items-center justify-between bg-[#2D4256] px-6 py-3">
            <div className="flex items-center gap-2 pl-2">
              <SettingsIcon className="h-4 w-4 text-white" />
              <h2 className="text-sm font-semibold text-white">Settings</h2>
            </div>
            {embedded ? (
              <DialogClose asChild>
                <button type="button" className="rounded-sm p-1 text-white hover:text-white/80" aria-label="Close settings">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            ) : null}
          </header>

          <div className="min-h-0 flex-1 bg-white px-6 pb-4 pt-4">
            <div className="flex h-full min-h-0 items-stretch gap-4">
            <aside className="h-full w-[165px] overflow-hidden rounded-sm bg-white">
              <div className="space-y-0">
                {settingsTabs.map((tab) => {
                  const isActive = settingsTab === tab.value;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => handleSettingsTabChange(tab.value)}
                      className={`group mx-1 my-0.5 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded px-4 py-3 text-left text-[10px] font-semibold transition-colors ${
                        isActive
                          ? "bg-[#e9f9eb] text-[#2f9f36]"
                          : "text-slate-500 hover:text-black"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ${
                          isActive ? "" : "group-hover:translate-x-[2px]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span
                        className={`text-[10px] font-semibold leading-4 ${
                          isActive ? "" : "group-hover:translate-x-[2px]"
                        }`}
                      >
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-w-0 flex-1 min-h-0 flex flex-col">
            <section className="relative min-h-0 flex-1 overflow-y-auto rounded-sm bg-white px-4 py-3 text-[11px] text-slate-700 [&_.text-muted-foreground]:!text-slate-500 [&_input]:h-[34px] [&_input]:w-full [&_input]:rounded [&_input]:border-[0.5px] [&_input]:border-slate-400 [&_input]:bg-white [&_input]:px-3 [&_input]:text-[11px] [&_input]:font-medium [&_input]:text-slate-900 [&_input]:shadow-none [&_input]:placeholder:text-[10px] [&_input]:placeholder:text-slate-400 [&_input:hover]:border-blue-400 [&_input]:focus-visible:border-slate-300 [&_input]:focus-visible:ring-0 [&_input]:focus-visible:ring-offset-0 [&_[role=combobox]]:h-[34px] [&_[role=combobox]]:w-full [&_[role=combobox]]:rounded [&_[role=combobox]]:border-[0.5px] [&_[role=combobox]]:border-slate-400 [&_[role=combobox]]:bg-white [&_[role=combobox]]:px-3 [&_[role=combobox]]:text-[11px] [&_[role=combobox]]:font-medium [&_[role=combobox]]:text-slate-900 [&_[role=combobox]]:shadow-none [&_[role=combobox]:hover]:border-blue-400 [&_[role=combobox]]:focus:border-blue-600 [&_[role=combobox]]:focus-visible:border-blue-600 [&_[role=combobox]]:focus-visible:ring-0 [&_[role=combobox]]:focus-visible:ring-offset-0 [&_[role=combobox]]:data-[state=open]:border-blue-600">
              {isCurrentTabLoading ? (
                <div className="flex h-full items-center justify-center">
                  <img src="/llasa_thumbnail.png" alt="Loading tab" className="h-10 w-10 animate-spin" style={{ animationDuration: "2s" }} />
                </div>
              ) : (
                <>
              {settingsTab === "user" && (
            <div className="flex h-full flex-col space-y-5">
              <div className="space-y-1">
                <h3 className="text-[20px] font-semibold text-blue-600">User Details</h3>
                <p className="mb-2 text-[11px] text-slate-500">Update your personal information</p>
              </div>
              <div className="flex flex-1 flex-col gap-7">
                <div className="space-y-1 pt-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Personal Information</h4>
                  <div className="h-[0.5px] w-full bg-[#3eca44]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>First Name</span>
                    <Input
                      id="user_name"
                      value={userDetails.user_name}
                      onChange={(e) =>
                        setUserDetails({ ...userDetails, user_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Last Name</span>
                    <Input
                      id="user_surname"
                      value={userDetails.user_surname}
                      onChange={(e) =>
                        setUserDetails({ ...userDetails, user_surname: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1 pt-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Contact Information</h4>
                  <div className="h-[0.5px] w-full bg-[#3eca44]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Email</span>
                    <Input
                      id="user_email"
                      type="email"
                      value={userDetails.user_email}
                      onChange={(e) =>
                        setUserDetails({ ...userDetails, user_email: e.target.value })
                      }
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Contact Number</span>
                    <Input
                      id="user_contact"
                      value={userDetails.user_contact}
                      onChange={(e) =>
                        setUserDetails({ ...userDetails, user_contact: e.target.value })
                      }
                    />
                  </div>
                </div>
                {isUserDirty ? (
                  <div className={settingsActionRowClass}>
                    <Button onClick={handleUserDetailsUpdate} disabled={saving} className={popupActionButtonClass}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
              )}

              {settingsTab === "subusers" && (
            <div className="flex h-full flex-col space-y-4">
              <div className="space-y-1">
                <h3 className="text-[20px] font-semibold text-blue-600">Subusers</h3>
                <p className="mb-2 text-[11px] text-slate-500">
                  Here, the main user can create and manage active subusers.
                </p>
              </div>
              <div className={settingsActionRowClass.replace("justify-center", "justify-start")}>
                <Button
                  type="button"
                  onClick={() => setIsInviteSubuserOpen(true)}
                  className={popupActionButtonClass}
                >
                  Add Subuser
                </Button>
              </div>
              <div className="overflow-hidden rounded border border-slate-200">
                <div className="grid grid-cols-[1.4fr_1.4fr_1.2fr_1fr] items-center gap-2 bg-[#2D4256] px-3 py-2 text-[10px] font-semibold text-white">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Contact Number</div>
                  <div>Role</div>
                </div>
                <div className="max-h-[330px] divide-y overflow-y-auto bg-white text-[11px]">
                  {subusersLoading ? (
                    <div className="px-3 py-3 text-slate-500">Loading subusers...</div>
                  ) : subusersList.length === 0 ? (
                    <div className="px-3 py-3 text-slate-500">No active subusers found.</div>
                  ) : (
                    subusersList.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1.4fr_1.4fr_1.2fr_1fr] items-center gap-2 px-3 py-2 hover:bg-[#3eca44]/5">
                        <div className="truncate text-slate-900">{`${item.name || ""} ${item.surname || ""}`.trim() || "--"}</div>
                        <div className="truncate text-slate-700">{item.email || "--"}</div>
                        <div className="truncate text-slate-700">{item.contact_number || "--"}</div>
                        <div className="truncate text-slate-700">{item.role || "--"}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
              )}

              {settingsTab === "company" && (
            <div className="flex h-full flex-col space-y-5">
              <div className="space-y-1">
                <h3 className="text-[20px] font-semibold text-blue-600">Company Profile</h3>
                <p className="mb-2 text-[11px] text-slate-500">Update your company details</p>
              </div>
              <div className="flex flex-1 flex-col gap-7">
                <div className="space-y-1 pt-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Company Information</h4>
                  <div className="h-[0.5px] w-full bg-[#3eca44]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Company Name</span>
                    <Input
                      id="company_name"
                      value={companyDetails.company_name}
                      readOnly
                      tabIndex={-1}
                      className={companyProfileReadOnlyInputClass}
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Trading as</span>
                    <Input
                      id="company_type"
                      value={companyDetails.company_type}
                      readOnly
                      tabIndex={-1}
                      className={companyProfileReadOnlyInputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Registration Number</span>
                    <Input
                      id="registration_number"
                      value={companyDetails.registration_number}
                      readOnly
                      tabIndex={-1}
                      className={companyProfileReadOnlyInputClass}
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>VAT Number</span>
                    <Input
                      id="vat_number"
                      value={companyDetails.vat_number}
                      readOnly
                      tabIndex={-1}
                      className={companyProfileReadOnlyInputClass}
                    />
                  </div>
                </div>
                <div className="space-y-1 pt-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Contact Information</h4>
                  <div className="h-[0.5px] w-full bg-[#3eca44]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Company Contact</span>
                    <Input
                      id="company_contact"
                      value={companyDetails.company_contact}
                      readOnly
                      tabIndex={-1}
                      className={companyProfileReadOnlyInputClass}
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Company Email</span>
                    <Input
                      id="company_email"
                      type="email"
                      value={companyDetails.company_email}
                      readOnly
                      tabIndex={-1}
                      className={companyProfileReadOnlyInputClass}
                    />
                  </div>
                </div>
                <div className="space-y-1 pt-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Company Representative</h4>
                  <div className="h-[0.5px] w-full bg-[#3eca44]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Representative First Name</span>
                    <Input
                      id="representative_name"
                      value={companyDetails.representative_name}
                      readOnly
                      tabIndex={-1}
                      className={companyProfileReadOnlyInputClass}
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Representative Last Name</span>
                    <Input
                      id="representative_surname"
                      value={companyDetails.representative_surname}
                      readOnly
                      tabIndex={-1}
                      className={companyProfileReadOnlyInputClass}
                    />
                  </div>
                </div>
                {isCompanyProfileDirty ? (
                  <div className={settingsActionRowClass}>
                    <Button onClick={handleCompanyDetailsUpdate} disabled={saving} className={popupActionButtonClass}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
              )}

              {settingsTab === "companyAddress" && (
            <div className="flex h-full flex-col space-y-5">
              <div className="space-y-1">
                <h3 className="text-[20px] font-semibold text-blue-600">Company Address</h3>
                <p className="mb-2 text-[11px] text-slate-500">Physical and postal address details.</p>
              </div>
              <div className="flex flex-1 flex-col gap-7">
                <div className="space-y-1 pt-3">
                  <div className="grid grid-cols-2 gap-6 items-start">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Physical</h4>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Postal</h4>
                  </div>
                  <div className="h-[0.5px] w-full bg-[#3eca44]" />
                </div>
                <div className="flex flex-col gap-7">
                  <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Address Line 1</span>
                      <Input
                        id="physical_address_line1"
                        value={companyDetails.physical_address_line1}
                        readOnly
                        tabIndex={-1}
                        className={companyProfileReadOnlyInputClass}
                      />
                    </div>
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Address Line 1</span>
                      <Input
                        id="postal_address_line1"
                        value={companyDetails.postal_address_line1}
                        readOnly
                        tabIndex={-1}
                        className={companyProfileReadOnlyInputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Address Line 2</span>
                      <Input
                        id="physical_address_line2"
                        value={companyDetails.physical_address_line2}
                        readOnly
                        tabIndex={-1}
                        className={companyProfileReadOnlyInputClass}
                      />
                    </div>
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Address Line 2</span>
                      <Input
                        id="postal_address_line2"
                        value={companyDetails.postal_address_line2}
                        readOnly
                        tabIndex={-1}
                        className={companyProfileReadOnlyInputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>City</span>
                      <Input
                        id="city"
                        value={companyDetails.city}
                        readOnly
                        tabIndex={-1}
                        className={companyProfileReadOnlyInputClass}
                      />
                    </div>
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>City</span>
                      <Input
                        id="postal_city"
                        value={companyDetails.postal_city}
                        readOnly
                        tabIndex={-1}
                        className={companyProfileReadOnlyInputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Province</span>
                      <Input
                        id="province"
                        value={companyDetails.province}
                        readOnly
                        tabIndex={-1}
                        className={companyProfileReadOnlyInputClass}
                      />
                    </div>
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Province</span>
                      <Input
                        id="postal_province"
                        value={companyDetails.postal_province}
                        readOnly
                        tabIndex={-1}
                        className={companyProfileReadOnlyInputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Area Code</span>
                      <Input
                        id="area_code"
                        value={companyDetails.area_code}
                        readOnly
                        tabIndex={-1}
                        className={companyProfileReadOnlyInputClass}
                      />
                    </div>
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Postal Code</span>
                      <Input
                        id="postal_area_code"
                        value={companyDetails.postal_area_code}
                        readOnly
                        tabIndex={-1}
                        className={companyProfileReadOnlyInputClass}
                      />
                    </div>
                  </div>
                </div>
              {isCompanyAddressDirty ? (
                <div className={settingsActionRowClass}>
                  <Button onClick={handleCompanyDetailsUpdate} disabled={saving} className={popupActionButtonClass}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              ) : null}
              </div>
            </div>
              )}

              {settingsTab === "auth" && (
            <div className="flex h-full flex-col space-y-5">
              <div className="space-y-1">
                <h3 className="text-[20px] font-semibold text-blue-600">Authentication</h3>
                <p className="mb-2 text-[11px] text-slate-500">Change your password here whenever you need to keep your account secure.</p>
              </div>
              <div className="flex flex-1 flex-col gap-7">
                <div className="space-y-1 pt-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Reset Password</h4>
                  <div className="h-[0.5px] w-full bg-[#3eca44]" />
                </div>
                <div className="grid max-w-[760px] grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>New Password</span>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, newPassword: e.target.value })
                        }
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Confirm New Password</span>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                        }
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-sm text-destructive">{passwordError}</p>
                    )}
                  </div>
                </div>
                {shouldShowAuthAction ? (
                  <div className={settingsActionRowClass}>
                    <Button onClick={handlePasswordReset} disabled={saving} className={popupActionButtonClass}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Password
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
              )}

              {settingsTab === "companySetup" && (
                <div className="flex h-full min-h-0 flex-col space-y-5" onClickCapture={handleCompanySetupClickCapture}>
                  <div className="space-y-1">
                    <h3 className="text-[20px] font-semibold text-blue-600">Company Setup</h3>
                    <p className="mb-2 text-[11px] text-slate-500">Enable branch management to organize employees by location and assign them to the correct operating unit across your business.</p>
                  </div>
                  <div className="h-[410px] rounded-sm bg-white">
                    <div className="h-full overflow-y-auto">
                      <div className="flex flex-col gap-5">
                  <div className="space-y-1 pt-3">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Company Branches</h4>
                    <div className="h-[0.5px] w-full bg-[#3eca44]" />
                  </div>
                  <div className="flex flex-col gap-7">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="branches_enabled"
                          className="-mt-0.5 scale-90 data-[state=checked]:!bg-blue-600 data-[state=unchecked]:!bg-slate-300"
                          checked={branchSettings.branches_enabled}
                          disabled={branchEditMode || branchSaving}
                          onCheckedChange={async (checked) => {
                            const nextEnabled = Boolean(checked);
                            setBranchSaving(true);
                            const persisted = await persistBranchSettings(nextEnabled, branchSettings.branches);
                            setBranchSaving(false);
                            if (!persisted) return;

                            applyLocalBranchSettings(nextEnabled, branchSettings.branches);
                            if (!nextEnabled) {
                              setShowBranchForm(false);
                              setBranchEditMode(false);
                              setSelectedBranchName(null);
                              setBranchForm(emptyBranchForm);
                              clearAllocatedBranchEditMode();
                              handleBranchAllocationDialogChange(false);
                            }
                          }}
                        />
                        <Label htmlFor="branches_enabled" className="text-[11px] !text-slate-600">
                          Activate Branches
                        </Label>
                      </div>

                      {branchSettings.branches_enabled ? (
                        <>
                          <div className="-mt-2 flex flex-col gap-[18px]">
                            {branchSettings.branches.length > 0 ? (
                              <div className="grid grid-cols-[340px_1fr] items-center gap-2">
                                <div className="relative">
                                  <Input
                                    data-branch-edit-allowed="true"
                                    className="!h-7 !border !border-slate-300 px-2 pr-7 text-[10px] placeholder:text-[10px] hover:border-blue-400 focus:border-blue-600 focus-visible:!border-blue-600"
                                    placeholder="Search branches"
                                    value={branchSearchQuery}
                                    onChange={(e) => setBranchSearchQuery(e.target.value)}
                                    onFocus={() => setBranchSearchFocused(true)}
                                    onBlur={() => setBranchSearchFocused(false)}
                                  />
                                  {!branchSearchFocused ? (
                                    <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                  ) : null}
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setSelectedBranchName(null);
                                      setBranchForm(emptyBranchForm);
                                      setShowBranchForm(true);
                                    }}
                                    disabled={branchSaving}
                                    className={`h-7 w-[92px] rounded px-2 text-[10px] inline-flex items-center justify-center border-[0.5px] border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white ${
                                      showBranchForm ? "bg-blue-600 text-white hover:bg-blue-700" : ""
                                    }`}
                                  >
                                    New Branch
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-start">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setBranchEditMode(false);
                                    setSelectedBranchName(null);
                                    setBranchForm(emptyBranchForm);
                                    setShowBranchForm(true);
                                  }}
                                  disabled={branchEditMode || branchSaving}
                                  className={`h-7 w-[92px] rounded px-2 text-[10px] inline-flex items-center justify-center border-[0.5px] border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white ${
                                    showBranchForm ? "bg-blue-600 text-white hover:bg-blue-700" : ""
                                  }`}
                                >
                                  New Branch
                                </Button>
                              </div>
                            )}

                            {branchSettings.branches.length > 0 ? (
                              <>
                                <div
                                  data-branch-edit-allowed="true"
                                  className="relative rounded border border-slate-300 bg-white px-3 pb-2 pt-3"
                                >
                                  <span
                                    className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold leading-none text-slate-500"
                                  >
                                    Branch List
                                  </span>
                                  <div className="max-h-[130px] overflow-y-auto pt-1">
                                    <div className="flex flex-wrap gap-2">
                                      {branchSettings.branches
                                        .filter((branchEntry) =>
                                          branchEntry.name.toLowerCase().includes(branchSearchQuery.trim().toLowerCase()),
                                        )
                                        .map((branchEntry) => (
                                        <Badge
                                          data-branch-edit-allowed="true"
                                          key={branchEntry.name}
                                          variant="outline"
                                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] leading-none !font-normal ${
                                            selectedBranchToEdit === branchEntry.name && showEditBranchForm
                                              ? "cursor-pointer border-blue-600 bg-blue-600 text-white"
                                              : "cursor-pointer border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                          }`}
                                          onClick={() => handleSelectBranchForEdit(branchEntry.name)}
                                        >
                                          <span>{branchEntry.name}</span>
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              void handleRemoveBranch(branchEntry.name);
                                            }}
                                            className="ml-1 inline-flex items-center text-blue-600 hover:text-red-600"
                                            aria-label={`Remove ${branchEntry.name}`}
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <p className="mt-[-10px] text-[10px] text-slate-500">
                                  Select a branch pill to open and edit branch details.
                                </p>
                              </>
                            ) : null}
                          </div>

                          <div className="space-y-1 pt-3">
                            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Branch Allocation</h4>
                            <div className="h-[0.5px] w-full bg-[#3eca44]" />
                          </div>
                          <div className="-mt-[10px] grid grid-cols-[340px_1fr] items-center gap-2">
                            <div className="flex items-center gap-1">
                              <div className="relative flex-1">
                                <Input
                                  data-allocated-branch-edit-allowed="true"
                                  className="!h-7 !border !border-slate-300 px-2 pr-7 text-[10px] placeholder:text-[10px] hover:border-blue-400 focus:border-blue-600 focus-visible:!border-blue-600"
                                  placeholder="Search by branch or employees"
                                  value={allocatedBranchSearchQuery}
                                  disabled={branchNames.length === 0}
                                  onChange={(e) => setAllocatedBranchSearchQuery(e.target.value)}
                                  onFocus={() => setAllocatedBranchSearchFocused(true)}
                                  onBlur={() => setAllocatedBranchSearchFocused(false)}
                                />
                                {!allocatedBranchSearchFocused ? (
                                  <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                ) : null}
                              </div>
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      data-allocated-branch-edit-allowed="true"
                                      type="button"
                                      aria-label="Branch allocation search help"
                                      className="inline-flex h-6 w-6 items-center justify-center rounded bg-white text-slate-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                                      disabled={branchNames.length === 0}
                                    >
                                      <Info className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[260px] rounded text-[10px]">
                                    Search specific branches to view allocated employees, or search employees by name, surname, or ID number to view their allocated branches.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                onClick={() => handleBranchAllocationDialogChange(true)}
                                disabled={branchNames.length === 0}
                                className="h-7 min-w-[88px] rounded border-[0.5px] border-blue-600 bg-white px-3 text-[10px] text-blue-600 hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-blue-600"
                              >
                                Allocate
                              </Button>
                            </div>
                          </div>
                          <div
                            data-allocated-branch-edit-allowed="true"
                            className="-mt-2 relative rounded border border-slate-300 bg-white px-3 pb-2 pt-3"
                          >
                            <span
                              className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold leading-none text-slate-500"
                            >
                              Allocated Branches
                            </span>
                            <div className="max-h-[130px] overflow-y-auto pt-1">
                              {filteredAllocatedBranches.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {filteredAllocatedBranches.map((allocatedBranch) => (
                                    <Badge
                                      data-allocated-branch-edit-allowed="true"
                                      key={allocatedBranch}
                                      variant="outline"
                                      className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-[10px] leading-none !font-normal ${
                                        selectedAllocatedBranchToEdit === allocatedBranch && isAllocatedBranchEmployeesOpen
                                          ? "border-blue-600 bg-blue-600 text-white"
                                          : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                      }`}
                                      onClick={() => handleOpenAllocatedBranchEmployees(allocatedBranch)}
                                    >
                                      <span>{allocatedBranch}</span>
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-500">
                                  {allocatedBranches.length === 0
                                    ? "No branches have been allocated yet."
                                    : "No branches match your search."}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="mt-[-18px] text-[10px] text-slate-500">
                            Select an allocated branch pill to view its employee composition.
                          </p>
                          {branchNames.length === 0 ? (
                            <p className="text-[10px] text-slate-500">
                              Add at least one branch before allocating employees.
                            </p>
                          ) : null}

                        </>
                      ) : null}
                    </div>
                    </div>
                  </div>
                  <Dialog
                    open={showBranchForm}
                    onOpenChange={(open) => {
                      setShowBranchForm(open);
                      if (!open) setBranchForm(emptyBranchForm);
                    }}
                  >
                    <DialogContent
                      className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden"
                      onCloseAutoFocus={(event) => event.preventDefault()}
                    >
                      <div className="relative">
                        <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                          <div className="flex items-center gap-2 pl-2">
                            <Network className="h-4 w-4 text-white" />
                            <DialogTitle className="text-sm font-semibold text-white">New Branch</DialogTitle>
                          </div>
                          <DialogClose asChild>
                            <button type="button" className="text-white hover:text-white/80" aria-label="Close new branch popup">
                              <X className="h-4 w-4" />
                            </button>
                          </DialogClose>
                        </div>
                        <div className="mt-[46px] bg-white">
                      <form
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const draft = { ...branchForm };
                          const added = await handleAddBranch(draft);
                          if (!added) return;
                          setShowBranchForm(false);
                          setBranchForm(emptyBranchForm);
                        }}
                        className="space-y-4 px-6 pb-6 pt-[26px]"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              Branch Name
                            </span>
                            <Input
                              className={subuserModalInputClass}
                              placeholder="Please insert a short branch name."
                              value={branchForm.name}
                              onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              Address Line 1
                            </span>
                            <Input
                              className={subuserModalInputClass}
                              placeholder="Please insert address line 1"
                              value={branchForm.address_line1}
                              onChange={(e) => setBranchForm((prev) => ({ ...prev, address_line1: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              Address Line 2
                            </span>
                            <Input
                              className={subuserModalInputClass}
                              placeholder="Please insert address line 2"
                              value={branchForm.address_line2}
                              onChange={(e) => setBranchForm((prev) => ({ ...prev, address_line2: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              City
                            </span>
                            <Input
                              className={subuserModalInputClass}
                              placeholder="Please insert city"
                              value={branchForm.city}
                              onChange={(e) => setBranchForm((prev) => ({ ...prev, city: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              Province
                            </span>
                            <Select
                              value={branchForm.province}
                              onValueChange={(value) => setBranchForm((prev) => ({ ...prev, province: value }))}
                            >
                              <SelectTrigger
                                aria-label="Branch province"
                                className="bg-white text-slate-900 hover:border-blue-400 focus:border-slate-300 focus-visible:border-slate-300 !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none data-[state=open]:border-slate-300 data-[state=open]:bg-white data-[placeholder]:!text-[10px] data-[placeholder]:!font-medium data-[placeholder]:!text-slate-400 !h-[34px] !rounded !border-[0.5px] !border-slate-400 !focus-visible:border-slate-300 !text-[11px] [&>span]:!text-[11px]"
                              >
                                <SelectValue placeholder="Please select province" />
                              </SelectTrigger>
                              <SelectContent className="text-[11px]">
                                {southAfricanProvinces.map((province) => (
                                  <SelectItem
                                    key={province}
                                    value={province}
                                    className="text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                                  >
                                    {province}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              Area Code
                            </span>
                            <Input
                              className={subuserModalInputClass}
                              placeholder="Please insert area code"
                              value={branchForm.area_code}
                              onChange={(e) => setBranchForm((prev) => ({ ...prev, area_code: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-[28px] w-[84px] rounded border-slate-300 px-3 text-xs text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-600"
                            onClick={() => {
                              setShowBranchForm(false);
                              setBranchForm(emptyBranchForm);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            className="h-[28px] w-[84px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-white"
                            disabled={
                              branchForm.name.trim().length === 0 ||
                              branchForm.address_line1.trim().length === 0 ||
                              branchForm.city.trim().length === 0 ||
                              branchForm.province.trim().length === 0 ||
                              branchForm.area_code.trim().length === 0 ||
                              branchSaving
                            }
                          >
                            Add Branch
                          </Button>
                        </div>
                      </form>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={showEditBranchForm}
                    onOpenChange={(open) => {
                      setShowEditBranchForm(open);
                      if (!open) {
                        handleCancelBranchAction();
                      }
                    }}
                  >
                    <DialogContent className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
                      <div className="relative">
                        <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                          <div className="flex items-center gap-2 pl-2">
                            <Building2 className="h-4 w-4 text-white" />
                            <DialogTitle className="text-sm font-semibold text-white">
                              {selectedBranchToEdit ? `Edit ${selectedBranchToEdit}` : "Edit Branch"}
                            </DialogTitle>
                          </div>
                          <DialogClose asChild>
                            <button type="button" className="text-white hover:text-white/80" aria-label="Close edit branches popup">
                              <X className="h-4 w-4" />
                            </button>
                          </DialogClose>
                        </div>
                        <div className="mt-[46px] bg-white">

                      <form
                        onSubmit={async (event) => {
                          event.preventDefault();
                          await handleApplyBranchEdit();
                        }}
                        className="space-y-4 px-6 pb-6 pt-[26px]"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              Branch Name
                            </span>
                            <Input
                              className={subuserModalInputClass}
                              placeholder="Please insert branch name"
                              value={branchEditDraft.name}
                              onChange={(e) => setBranchEditDraft((prev) => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              Address Line 1
                            </span>
                            <Input
                              className={subuserModalInputClass}
                              placeholder="Please insert address line 1"
                              value={branchEditDraft.address_line1}
                              onChange={(e) => setBranchEditDraft((prev) => ({ ...prev, address_line1: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              Address Line 2
                            </span>
                            <Input
                              className={subuserModalInputClass}
                              placeholder="Please insert address line 2"
                              value={branchEditDraft.address_line2}
                              onChange={(e) => setBranchEditDraft((prev) => ({ ...prev, address_line2: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              City
                            </span>
                            <Input
                              className={subuserModalInputClass}
                              placeholder="Please insert city"
                              value={branchEditDraft.city}
                              onChange={(e) => setBranchEditDraft((prev) => ({ ...prev, city: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              Province
                            </span>
                            <Select
                              value={branchEditDraft.province}
                              onValueChange={(value) => setBranchEditDraft((prev) => ({ ...prev, province: value }))}
                            >
                              <SelectTrigger
                                aria-label="Edit branch province"
                                className="bg-white text-slate-900 hover:border-blue-400 focus:border-slate-300 focus-visible:border-slate-300 !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none data-[state=open]:border-slate-300 data-[state=open]:bg-white data-[placeholder]:!text-[10px] data-[placeholder]:!font-medium data-[placeholder]:!text-slate-400 !h-[34px] !rounded !border-[0.5px] !border-slate-400 !focus-visible:border-slate-300 !text-[11px] [&>span]:!text-[11px]"
                              >
                                <SelectValue placeholder="Please select province" />
                              </SelectTrigger>
                              <SelectContent className="text-[11px]">
                                {southAfricanProvinces.map((province) => (
                                  <SelectItem
                                    key={province}
                                    value={province}
                                    className="text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                                  >
                                    {province}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <div className="relative w-full max-w-none">
                            <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                              Area Code
                            </span>
                            <Input
                              className={subuserModalInputClass}
                              placeholder="Please insert area code"
                              value={branchEditDraft.area_code}
                              onChange={(e) => setBranchEditDraft((prev) => ({ ...prev, area_code: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-[28px] w-[84px] rounded border-slate-300 px-3 text-xs text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-600"
                            onClick={() => {
                              const original = selectedBranchToEdit
                                ? branchSettings.branches.find((item) => item.name === selectedBranchToEdit) ?? null
                                : null;
                              if (!original) return;
                              setBranchEditDraft({
                                name: original.name,
                                address_line1: original.address_line1,
                                address_line2: original.address_line2,
                                city: original.city,
                                province: original.province,
                                area_code: original.area_code,
                              });
                            }}
                          >
                            Reset
                          </Button>
                          <Button
                            type="submit"
                            className="h-[28px] w-[84px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-white"
                            disabled={
                              !selectedBranchToEdit ||
                              branchEditDraft.name.trim().length === 0 ||
                              branchEditDraft.address_line1.trim().length === 0 ||
                              branchEditDraft.city.trim().length === 0 ||
                              branchEditDraft.province.trim().length === 0 ||
                              branchEditDraft.area_code.trim().length === 0 ||
                              branchSaving
                            }
                          >
                            {branchSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save
                          </Button>
                        </div>
                      </form>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isBranchAllocationOpen} onOpenChange={handleBranchAllocationDialogChange}>
                    <DialogContent
                      className="w-[94vw] max-w-[620px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden"
                      onCloseAutoFocus={(event) => event.preventDefault()}
                    >
                      <div className="relative">
                        <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                          <div className="flex items-center gap-2 pl-2">
                            <Network className="h-4 w-4 text-white" />
                            <DialogTitle className="text-sm font-semibold text-white">Branch Allocation</DialogTitle>
                          </div>
                          <DialogClose asChild>
                            <button type="button" className="text-white hover:text-white/80" aria-label="Close branch allocation popup">
                              <X className="h-4 w-4" />
                            </button>
                          </DialogClose>
                        </div>
                        <div className="mt-[46px] bg-white px-6 pb-6 pt-5">
                          <div className="mb-1 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
                            <div className="relative">
                              <Input
                                className={`${subuserModalInputClass} ${branchAllocationSearchFocused ? "!border-blue-600" : ""} pr-7 !focus:border-blue-600 !focus-visible:border-blue-600`}
                                placeholder={branchAllocationSearchFocused ? "" : "Search employees"}
                                value={branchAllocationSearchQuery}
                                onChange={(event) => setBranchAllocationSearchQuery(event.target.value)}
                                onFocus={() => setBranchAllocationSearchFocused(true)}
                                onBlur={() => setBranchAllocationSearchFocused(false)}
                              />
                              {!branchAllocationSearchFocused ? (
                                <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                              ) : null}
                            </div>
                            <div className="relative">
                              <Select
                                value={branchAllocationSelectedBranch}
                                onValueChange={(value) => {
                                  setBranchAllocationSelectedBranch(value);
                                  setBranchAllocationSelectedEmployeeIds(new Set());
                                }}
                              >
                                <SelectTrigger
                                  aria-label="Select branch for allocation"
                                  className="h-8 w-full justify-between rounded px-3 text-[11px] inline-flex items-center border border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white data-[state=open]:rounded-b-none data-[state=open]:bg-blue-600 data-[state=open]:text-white !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0"
                                >
                                  <SelectValue placeholder="Select Branch" />
                                </SelectTrigger>
                                <SelectContent className="rounded text-[11px]">
                                  {branchNames.map((branchName) => (
                                    <SelectItem
                                      key={branchName}
                                      value={branchName}
                                      className="text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                                    >
                                      {branchName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                            <div className="text-[10px] text-slate-600">
                              {branchAllocationSelectedBranch
                                ? (
                                  <>
                                    Please select employees who will be assigned to{" "}
                                    <span className="underline">{branchAllocationSelectedBranch}</span>.
                                  </>
                                )
                                : "Please select a branch to start assigning employees."}
                            </div>
                          </div>

                          <div className="mt-2 max-h-[300px] overflow-y-auto rounded border border-slate-300 bg-white">
                            {branchAllocationLoading ? (
                              <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                              </div>
                            ) : branchAllocationFilteredEmployees.length === 0 ? (
                              <div className="px-3 py-8 text-center text-[10px] text-slate-500">
                                No employees match your current filters.
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-100">
                                {branchAllocationFilteredEmployees.map((employee) => {
                                  const isSelected = branchAllocationSelectedEmployeeIds.has(employee.id);
                                  const hasSelectedBranch = branchAllocationSelectedBranch.trim().length > 0;
                                  const employeeName = `${employee.employee_name} ${employee.employee_surname}`.trim() || "Unnamed employee";
                                  return (
                                    <div
                                      key={employee.id}
                                      onClick={() => {
                                        if (!hasSelectedBranch) return;
                                        toggleBranchAllocationEmployeeSelection(employee.id);
                                      }}
                                      onKeyDown={(event) => {
                                        if (!hasSelectedBranch) return;
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          toggleBranchAllocationEmployeeSelection(employee.id);
                                        }
                                      }}
                                      role="button"
                                      tabIndex={0}
                                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                                        !hasSelectedBranch
                                          ? "cursor-not-allowed bg-slate-50/70"
                                          : `cursor-pointer hover:bg-slate-50 ${isSelected ? "bg-blue-50/70" : "bg-white"}`
                                      }`}
                                    >
                                      <div className="flex min-w-0 items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          disabled={!hasSelectedBranch}
                                          readOnly
                                          className="pointer-events-none h-3.5 w-3.5 accent-blue-600"
                                        />
                                        <div className="min-w-0">
                                          <p className="truncate text-[11px] font-medium text-slate-800">
                                            {employeeName}
                                            {employee.id_number ? ` (${employee.id_number})` : " (No ID number)"}
                                          </p>
                                        </div>
                                      </div>
                                      {employee.branchNames.length > 1 ? (
                                        <TooltipProvider delayDuration={150}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="shrink-0 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                                                {employee.branchNames.length} branches
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-[220px] rounded text-[10px]">
                                              <div className="space-y-1">
                                                {employee.branchNames.map((branchName) => (
                                                  <p key={`${employee.id}-${branchName}`} className="leading-tight text-slate-700">
                                                    {branchName}
                                                  </p>
                                                ))}
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : (
                                        <span className="shrink-0 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                                          {employee.branchNames[0] ?? "Unassigned"}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {branchAllocationSelectedEmployees.length > 0 ? (
                            <div className="mt-2 max-h-[130px] overflow-y-auto rounded border border-slate-300 bg-white px-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                {branchAllocationSelectedEmployees.map((employee) => {
                                  const firstInitial = employee.employee_name.trim().charAt(0).toUpperCase();
                                  const surname = employee.employee_surname.trim();
                                  const idPart = employee.id_number ? ` (${employee.id_number})` : " (No ID number)";
                                  const employeeName =
                                    firstInitial && surname ? `${firstInitial}. ${surname}${idPart}` : `Unnamed employee${idPart}`;
                                  return (
                                    <Badge
                                      key={employee.id}
                                      variant="outline"
                                      className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-[10px] leading-none !font-normal text-blue-700 hover:bg-blue-100"
                                    >
                                      <span className="max-w-[210px] truncate">{employeeName}</span>
                                      <button
                                        type="button"
                                        className="inline-flex items-center text-blue-700 hover:text-blue-900"
                                        onClick={() => toggleBranchAllocationEmployeeSelection(employee.id)}
                                        aria-label={`Remove ${employeeName}`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          <div className="flex items-center justify-center gap-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-[28px] w-[84px] rounded border-slate-300 px-3 text-xs text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-600"
                              onClick={() => setBranchAllocationSelectedEmployeeIds(new Set())}
                              disabled={branchAllocationSubmitting || branchAllocationSelectedEmployeeIds.size === 0}
                            >
                              Clear
                            </Button>
                            <Button
                              type="button"
                              className="h-[28px] min-w-[110px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-white"
                              onClick={handleBranchAllocationApply}
                              disabled={
                                branchAllocationSubmitting ||
                                branchAllocationLoading ||
                                !branchAllocationSelectedBranch ||
                                branchAllocationPendingChanges.totalChanges === 0
                              }
                            >
                              {branchAllocationSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isAllocatedBranchEmployeesOpen} onOpenChange={handleAllocatedBranchEmployeesDialogChange}>
                    <DialogContent
                      className="w-[94vw] max-w-[620px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden"
                      onCloseAutoFocus={(event) => event.preventDefault()}
                    >
                      <div className="relative">
                        <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                          <div className="flex items-center gap-2 pl-2">
                            <Building2 className="h-4 w-4 text-white" />
                            <DialogTitle className="text-sm font-semibold text-white">Branch Composition</DialogTitle>
                          </div>
                          <DialogClose asChild>
                            <button type="button" className="text-white hover:text-white/80" aria-label="Close allocated employees popup">
                              <X className="h-4 w-4" />
                            </button>
                          </DialogClose>
                        </div>
                        <div className="mt-[46px] bg-white px-6 pb-6 pt-5">
                          <div className="relative">
                            <Input
                              className={`${subuserModalInputClass} ${allocatedBranchEmployeesSearchFocused ? "!border-blue-600" : ""} pr-7 !focus:border-blue-600 !focus-visible:border-blue-600`}
                              placeholder={
                                allocatedBranchEmployeesSearchFocused
                                  ? ""
                                  : selectedAllocatedBranchToEdit
                                    ? `Search employees at ${selectedAllocatedBranchToEdit}`
                                    : "Search employees"
                              }
                              value={allocatedBranchEmployeesSearchQuery}
                              onChange={(event) => setAllocatedBranchEmployeesSearchQuery(event.target.value)}
                              onFocus={() => setAllocatedBranchEmployeesSearchFocused(true)}
                              onBlur={() => setAllocatedBranchEmployeesSearchFocused(false)}
                            />
                            {!allocatedBranchEmployeesSearchFocused ? (
                              <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            ) : null}
                          </div>

                          <div className="mt-3 max-h-[340px] overflow-y-auto rounded border border-slate-300 bg-white">
                            {branchAllocationLoading ? (
                              <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                              </div>
                            ) : filteredAllocatedBranchEmployees.length === 0 ? (
                              <div className="px-3 py-8 text-center text-[10px] text-slate-500">
                                {selectedAllocatedBranchToEdit
                                  ? "No employees match your current search."
                                  : "Please select a branch first."}
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-100">
                                {filteredAllocatedBranchEmployees.map((employee) => {
                                  const isSelected = allocatedBranchSelectedEmployeeIds.has(employee.id);
                                  const employeeName = `${employee.employee_name} ${employee.employee_surname}`.trim() || "Unnamed employee";
                                  return (
                                    <div
                                      key={employee.id}
                                      onClick={() => toggleAllocatedBranchEmployeeSelection(employee.id)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          toggleAllocatedBranchEmployeeSelection(employee.id);
                                        }
                                      }}
                                      role="button"
                                      tabIndex={0}
                                      className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 ${
                                        isSelected ? "bg-blue-50/70" : "bg-white"
                                      }`}
                                    >
                                      <div className="flex min-w-0 items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          readOnly
                                          className="pointer-events-none h-3.5 w-3.5 accent-blue-600"
                                        />
                                        <div className="min-w-0">
                                          <p className="truncate text-[11px] font-medium text-slate-800">
                                            {employeeName}
                                            {employee.id_number ? ` (${employee.id_number})` : " (No ID number)"}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="shrink-0 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                                        Allocated
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-center gap-2 pt-6">
                            <Button
                              type="button"
                              className="h-[28px] min-w-[110px] rounded bg-red-600 px-3 text-xs text-white hover:bg-red-700 disabled:bg-slate-300 disabled:text-white"
                              onClick={handleRemoveAllocatedBranchEmployees}
                              disabled={
                                allocatedBranchRemoveSubmitting ||
                                branchAllocationLoading ||
                                allocatedBranchSelectedEmployeeIds.size === 0
                              }
                            >
                              {allocatedBranchRemoveSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              )}

              {settingsTab === "personalize" && (
                <div className="flex h-full flex-col space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-[20px] font-semibold text-blue-600">Personalise</h3>
                    <p className="mb-2 text-[11px] text-slate-500">Fine-tune how your documents look so every output feels more aligned with your brand and communication style.</p>
                  </div>

                  <div className="space-y-1 pt-3">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Company Logo</h4>
                    <div className="h-[0.5px] w-full bg-[#3eca44]" />
                  </div>

                  <div
                    className={`grid items-start gap-6 ${
                      personaliseLogoPreview ? "grid-cols-[320px_1fr]" : "max-w-[320px] grid-cols-1"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="personaliseLogoUpload" className="text-[11px] font-semibold text-slate-700">
                        Company logo (optional)
                      </Label>
                      <div className="space-y-2">
                        <input
                          id="personaliseLogoUpload"
                          ref={personaliseLogoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          onChange={handlePersonaliseLogoSelect}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-[30px] min-w-[84px] rounded border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:border-blue-600 hover:bg-white hover:text-blue-600"
                            onClick={() => personaliseLogoInputRef.current?.click()}
                          >
                            {personaliseLogoPreview ? "Change" : "Upload logo"}
                          </Button>
                          {personaliseLogoPreview ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-[30px] min-w-[84px] border-0 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-none hover:bg-white hover:text-red-600 hover:underline hover:underline-offset-2"
                              onClick={handleRemovePersonaliseLogo}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                        {personaliseLogoPreview ? (
                          <div className="inline-block w-fit rounded border border-slate-300 bg-white p-2">
                            <img
                              src={personaliseLogoPreview}
                              alt="Company logo preview"
                              className="h-20 w-auto object-contain"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {personaliseLogoPreview ? (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-slate-700">Logo layout</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPersonaliseLogoLayout("vertical")}
                            className="text-left"
                          >
                            <div
                              className={`flex h-[86px] items-center justify-center rounded border p-2 transition ${
                                personaliseLogoLayout === "vertical"
                                  ? "border-blue-600 bg-blue-50"
                                  : "border-slate-300 bg-white hover:border-blue-500"
                              }`}
                            >
                              <div className="flex flex-col items-center">
                                <div className="h-5 w-5 rounded-md bg-blue-600/90" />
                                <div className="mt-1.5 h-1.5 w-12 rounded bg-slate-700/80" />
                                <div className="mt-1 h-1 w-9 rounded bg-slate-400/90" />
                              </div>
                            </div>
                            <p className="mt-1.5 text-center text-[11px] font-semibold text-slate-700">Vertical</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPersonaliseLogoLayout("horizontal")}
                            className="text-left"
                          >
                            <div
                              className={`flex h-[86px] items-center justify-center rounded border p-2 transition ${
                                personaliseLogoLayout === "horizontal"
                                  ? "border-blue-600 bg-blue-50"
                                  : "border-slate-300 bg-white hover:border-blue-500"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="h-5 w-5 rounded-md bg-blue-600/90" />
                                <div>
                                  <div className="h-1.5 w-10 rounded bg-slate-700/80" />
                                  <div className="mt-1 h-1 w-8 rounded bg-slate-400/90" />
                                </div>
                              </div>
                            </div>
                            <p className="mt-1.5 text-center text-[11px] font-semibold text-slate-700">Horizontal</p>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {isPersonaliseDirty ? (
                    <div className={settingsActionRowClass}>
                      <Button onClick={handlePersonaliseUpdate} disabled={saving} className={popupActionButtonClass}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                      </Button>
                    </div>
                  ) : null}

                </div>
              )}
                </>
              )}
            </section>

            <Dialog open={isInviteSubuserOpen} onOpenChange={handleSubuserInviteDialogChange}>
              <DialogContent
                className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <div className="relative">
                  <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                    <div className="flex items-center gap-2 pl-2">
                      <UserPlus className="h-4 w-4 text-white" />
                      <DialogTitle className="text-sm font-semibold text-white">Add Subuser</DialogTitle>
                    </div>
                    <DialogClose asChild>
                      <button type="button" className="text-white hover:text-white/80" aria-label="Close invite popup">
                        <X className="h-4 w-4" />
                      </button>
                    </DialogClose>
                  </div>
                  <div className="mt-[46px] bg-white">
                <div className="px-6 pt-0 pb-7"></div>
                <form onSubmit={handleSubuserInviteSubmit} className="space-y-4 px-6 pb-6 pt-0">
                  <div className="mx-auto w-full max-w-[320px] py-2">
                    <div className="relative grid grid-cols-2 items-start">
                      <div className="pointer-events-none absolute left-[calc(25%+26px)] top-[10px] h-[2px] w-[calc(50%-52px)] bg-slate-300" />
                      {subuserInviteStep > 1 && <div className="pointer-events-none absolute left-[calc(25%+26px)] top-[10px] h-[2px] w-[calc(50%-52px)] bg-[#3eca44]" />}
                      {[{ step: 1 as const, label: "Details" }, { step: 2 as const, label: "Authentication" }].map((item) => {
                        const active = subuserInviteStep === item.step;
                        const done = subuserInviteStep > item.step;
                        return (
                          <div key={item.step} className="z-10 flex flex-col items-center text-center">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${active || done ? "bg-[#3ec74a] text-white" : "bg-slate-400 text-white"}`}>
                              {done ? <Plus className="h-3 w-3" /> : item.step}
                            </span>
                            <span className={`mt-2 text-[10px] font-semibold ${active ? "text-slate-700" : "text-slate-500"}`}>{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {subuserInviteStep === 1 ? (
                    <div className="w-full space-y-4">
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Name <span className="text-red-600">*</span></span>
                        <Input value={subuserInviteForm.name} onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, name: e.target.value }))} className={subuserModalInputClass} placeholder="Please insert name" required />
                      </div>
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Surname <span className="text-red-600">*</span></span>
                        <Input value={subuserInviteForm.surname} onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, surname: e.target.value }))} className={subuserModalInputClass} placeholder="Please insert surname" required />
                      </div>
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Contact Number <span className="text-red-600">*</span></span>
                        <Input value={subuserInviteForm.contact_number} onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, contact_number: e.target.value }))} className={subuserModalInputClass} placeholder="Please insert contact number" required />
                      </div>
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Email <span className="text-red-600">*</span></span>
                        <Input type="email" value={subuserInviteForm.email} onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, email: e.target.value }))} className={subuserModalInputClass} placeholder="Please insert email" required />
                      </div>
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Role <span className="text-red-600">*</span></span>
                        <Select value={subuserInviteForm.role || undefined} onValueChange={(value) => setSubuserInviteForm((prev) => ({ ...prev, role: value as SubuserInviteForm["role"] }))}>
                          <SelectTrigger
                            className="h-8 w-full justify-between rounded px-3 text-[11px] inline-flex items-center border border-slate-300 bg-white text-slate-900 hover:border-slate-500 data-[state=open]:rounded-b-none data-[state=open]:border-black data-[state=open]:bg-white data-[state=open]:text-slate-900 !ring-0 !ring-offset-0 focus:!border-black focus:!ring-0 focus:!ring-offset-0 focus-visible:!border-black focus-visible:!ring-0 focus-visible:!ring-offset-0"
                          >
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className="rounded text-[11px]">
                            <SelectItem value="Main" className="text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]">Main</SelectItem>
                            <SelectItem value="Consultant" className="text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]">Consultant</SelectItem>
                            <SelectItem value="Administrator" className="text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full space-y-4">
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Username <span className="text-red-600">*</span></span>
                        <Input value={subuserInviteForm.username} onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, username: e.target.value }))} className={subuserModalInputClass} placeholder="Please insert username" required />
                      </div>
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Password <span className="text-red-600">*</span></span>
                        <Input
                          type={showSubuserPassword ? "text" : "password"}
                          value={subuserInviteForm.password}
                          onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, password: e.target.value }))}
                          className={`${subuserModalInputClass} pr-8`}
                          placeholder="Please insert password"
                          required
                        />
                        <button
                          type="button"
                          aria-label={showSubuserPassword ? "Hide password" : "Show password"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          onClick={() => setShowSubuserPassword((prev) => !prev)}
                        >
                          {showSubuserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Confirm Password <span className="text-red-600">*</span></span>
                        <Input
                          type={showSubuserConfirmPassword ? "text" : "password"}
                          value={subuserInviteForm.confirmPassword}
                          onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                          className={`${subuserModalInputClass} pr-8`}
                          placeholder="Please confirm password"
                          required
                        />
                        <button
                          type="button"
                          aria-label={showSubuserConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          onClick={() => setShowSubuserConfirmPassword((prev) => !prev)}
                        >
                          {showSubuserConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-[28px] w-[90px] rounded border-slate-300 bg-white px-3 text-xs text-slate-600 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
                      onClick={() => {
                        if (subuserInviteStep === 2) {
                          setSubuserInviteStep(1);
                          return;
                        }
                        handleSubuserInviteDialogChange(false);
                      }}
                      disabled={subuserInviteSubmitting}
                    >
                      {subuserInviteStep === 2 ? "Back" : "Cancel"}
                    </Button>
                    <Button
                      type="submit"
                      className="h-[28px] w-[90px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b] disabled:bg-slate-300 disabled:text-white"
                      disabled={subuserInviteSubmitting || (subuserInviteStep === 1 ? !isSubuserStepOneComplete : !isSubuserStepTwoComplete)}
                    >
                      {subuserInviteSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {subuserInviteStep === 1 ? "Next" : "Submit"}
                    </Button>
                  </div>
                </form>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            </div>
          </div>
        </div>
        </div>
      </div>
  );

  if (embedded) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="h-[84vh] w-[94vw] max-w-[980px] gap-0 overflow-hidden rounded-sm border-0 bg-[#2D4256] p-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:rounded-sm [&>button]:hidden">
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return <DashboardLayout>{content}</DashboardLayout>;
};

export default Settings;





