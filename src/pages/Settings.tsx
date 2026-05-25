import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Plus, X, User, UserPlus, Users, Building2, Lock, MapPin, Settings as SettingsIcon, Trash2, Camera, Pencil, FileBadge2, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageDateStamp } from "@/components/DashboardLayout";
import { z } from "zod";
import { companySetupBaseSchema } from "@/lib/validation";
import { getSafeErrorMessage } from "@/lib/errorHandling";
import {
  cacheHeaderProfile,
  readCachedHeaderProfilePicture,
} from "@/lib/headerProfileCache";

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

type SubuserInviteForm = {
  name: string;
  surname: string;
  contact_number: string;
  email: string;
  role: "Main" | "Consultant" | "Administrator" | "";
  profile_picture: string;
  username: string;
  password: string;
  confirmPassword: string;
};
type SubuserListItem = {
  id: string;
  auth_user_id?: string | null;
  name: string;
  surname: string;
  contact_number: string | null;
  email: string;
  role: string | null;
  profile_picture?: string | null;
  created_at: string | null;
};

type MembershipOrganisation = "AHI Employers Organisation";

type MembershipListItem = {
  id: string;
  organisation: MembershipOrganisation;
  description: string;
  owner: string;
  file_name: string;
  storage_path: string;
  created_at: string | null;
  updated_at: string | null;
};

type MembershipForm = {
  organisation: MembershipOrganisation;
  description: string;
  owner: string;
  file: File | null;
  fileName: string;
};

type SettingsTab = "user" | "subusers" | "memberships" | "company" | "companyAddress" | "auth";
type ProfileDataGroup = "user" | "company";

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

const emptySubuserInviteForm: SubuserInviteForm = {
  name: "",
  surname: "",
  contact_number: "",
  email: "",
  role: "",
  profile_picture: "",
  username: "",
  password: "",
  confirmPassword: "",
};

const membershipOrganisations: MembershipOrganisation[] = ["AHI Employers Organisation"];

const emptyMembershipForm = (organisation: MembershipOrganisation = "AHI Employers Organisation"): MembershipForm => ({
  organisation,
  description: "",
  owner: "",
  file: null,
  fileName: "",
});

const LLASA_MEMBERSHIPS_BUCKET = "llasa-memberships";

type SettingsProfileCache = {
  userDetails?: UserDetailsForm;
  userProfilePicture?: string;
  companyDetails?: CompanyDetailsForm;
  loadedGroups: Set<ProfileDataGroup>;
};

const settingsProfileCacheByUser = new Map<string, SettingsProfileCache>();

const tabToProfileGroup: Record<SettingsTab, ProfileDataGroup | null> = {
  user: "user",
  subusers: null,
  memberships: null,
  company: "company",
  companyAddress: "company",
  auth: null,
};

const profileGroupToTabs: Record<ProfileDataGroup, SettingsTab[]> = {
  user: ["user"],
  company: ["company", "companyAddress"],
};

const emptyTabLoadingState: Record<SettingsTab, boolean> = {
  user: false,
  subusers: false,
  memberships: false,
  company: false,
  companyAddress: false,
  auth: false,
};

const allSettingsTabs: SettingsTab[] = ["user", "subusers", "memberships", "company", "companyAddress", "auth"];

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

const getInitials = (firstName: string, surname: string) =>
  `${String(firstName || "").trim().charAt(0)}${String(surname || "").trim().charAt(0)}`.trim().toUpperCase() || "U";

const slugifyMembershipOrganisation = (value: MembershipOrganisation) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const normalizeMembershipOrganisation = (value: unknown): MembershipOrganisation | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "ahi employers organisation" || normalized.includes("ahi")) return "AHI Employers Organisation";
  return null;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });

const isCompanyProfileColumnError = (error: unknown) => {
  const err = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  const message = String(err?.message || "").toLowerCase();
  const details = String(err?.details || "").toLowerCase();
  const hint = String(err?.hint || "").toLowerCase();
  const combined = `${message} ${details} ${hint}`;
  return (
    err?.code === "42703" ||
    err?.code === "PGRST204" ||
    (combined.includes("column") && combined.includes("company_")) ||
    (combined.includes("column") && combined.includes("registration_number")) ||
    (combined.includes("column") && combined.includes("vat_number")) ||
    (combined.includes("column") && combined.includes("physical_address")) ||
    (combined.includes("column") && combined.includes("postal_address")) ||
    (combined.includes("column") && combined.includes("representative_")) ||
    (combined.includes("could not find") && combined.includes("company_"))
  );
};

const isUserProfilePictureColumnError = (error: unknown) => {
  const err = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  const message = String(err?.message || "").toLowerCase();
  const details = String(err?.details || "").toLowerCase();
  const hint = String(err?.hint || "").toLowerCase();
  const combined = `${message} ${details} ${hint}`;
  return (
    err?.code === "42703" ||
    err?.code === "PGRST204" ||
    (combined.includes("column") && combined.includes("profile_picture")) ||
    (combined.includes("could not find") && combined.includes("profile_picture"))
  );
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
  const [userProfilePicture, setUserProfilePicture] = useState("");
  const [initialUserProfilePicture, setInitialUserProfilePicture] = useState("");

  const [companyDetails, setCompanyDetails] = useState<CompanyDetailsForm>(emptyCompanyDetails);
  const [initialCompanyDetails, setInitialCompanyDetails] = useState<CompanyDetailsForm>(emptyCompanyDetails);

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordError, setPasswordError] = useState("");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("user");
  const [isInviteSubuserOpen, setIsInviteSubuserOpen] = useState(false);
  const [subuserInviteForm, setSubuserInviteForm] = useState<SubuserInviteForm>(emptySubuserInviteForm);
  const [subuserInviteSubmitting, setSubuserInviteSubmitting] = useState(false);
  const [subuserInviteStep, setSubuserInviteStep] = useState<1 | 2 | 3>(1);
  const [showSubuserPassword, setShowSubuserPassword] = useState(false);
  const [showSubuserConfirmPassword, setShowSubuserConfirmPassword] = useState(false);
  const [subuserProfilePictureName, setSubuserProfilePictureName] = useState("");
  const [subusersList, setSubusersList] = useState<SubuserListItem[]>([]);
  const [subusersLoading, setSubusersLoading] = useState(false);
  const [deletingSubuserId, setDeletingSubuserId] = useState<string | null>(null);
  const [membershipsList, setMembershipsList] = useState<MembershipListItem[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [isMembershipDialogOpen, setIsMembershipDialogOpen] = useState(false);
  const [membershipForm, setMembershipForm] = useState<MembershipForm>(emptyMembershipForm());
  const [membershipSubmitting, setMembershipSubmitting] = useState(false);
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [deletingMembershipId, setDeletingMembershipId] = useState<string | null>(null);
  const [viewingMembershipId, setViewingMembershipId] = useState<string | null>(null);
  const [tabLoading, setTabLoading] = useState<Record<SettingsTab, boolean>>(emptyTabLoadingState);
  const [isMasterUser, setIsMasterUser] = useState(true);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);
  const loadedGroupsRef = useRef<Set<ProfileDataGroup>>(new Set());
  const loadingGroupsRef = useRef<Set<ProfileDataGroup>>(new Set());
  const userProfilePictureInputRef = useRef<HTMLInputElement | null>(null);
  const subuserProfilePictureInputRef = useRef<HTMLInputElement | null>(null);
  const membershipFileInputRef = useRef<HTMLInputElement | null>(null);

  const settingsTabs: Array<{ value: SettingsTab; label: string; icon: LucideIcon }> = [
    { value: "user", label: "User Details", icon: User },
    { value: "subusers", label: "Subusers", icon: Users },
    { value: "memberships", label: "Memberships", icon: FileBadge2 },
    { value: "company", label: "Company Profile", icon: Building2 },
    { value: "companyAddress", label: "Company Address", icon: MapPin },
    { value: "auth", label: "Authentication", icon: Lock },
  ];
  const canEditSettings = isMasterUser;
  const visibleSettingsTabs = settingsTabs;
  const authUsernameDisplay = useMemo(
    () =>
      String(user?.email || "").trim() ||
      String((user as any)?.user_metadata?.username || "").trim() ||
      "--",
    [user],
  );
  const membershipsByOrganisation = useMemo(
    () =>
      membershipOrganisations.reduce<Record<MembershipOrganisation, MembershipListItem[]>>((acc, organisation) => {
        acc[organisation] = membershipsList.filter((item) => item.organisation === organisation);
        return acc;
      }, {
        "AHI Employers Organisation": [],
      }),
    [membershipsList],
  );
  const popupActionButtonClass =
    "h-8 min-w-[108px] rounded px-3 text-[11px] inline-flex items-center justify-center border border-[#3eca44] bg-white text-[#2f9f35] hover:bg-[#34b73b] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-[#2f9f35]";
  const settingsTabScrollPaneClass =
    "flex-1 min-h-0 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";
  const membershipsScrollAreaStyle = {
    maxHeight: embedded
      ? "calc(84vh - 220px)"
      : "calc(100dvh - var(--app-header-height, 5rem) - 15rem)",
  } as const;
  const companyProfileReadOnlyInputClass =
    "bg-slate-100 text-slate-700 pointer-events-none cursor-default hover:border-slate-400 focus-visible:border-slate-400";
  const subuserModalInputClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-[#3eca44] !focus-visible:border-[1px] !focus-visible:border-[#3eca44] focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !h-[34px] !border-[0.5px] !border-slate-400 !focus-visible:border-slate-300";
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
    true;
  const isSubuserStepThreeComplete =
    subuserInviteForm.username.trim().length > 0 &&
    subuserInviteForm.password.trim().length > 0 &&
    subuserInviteForm.confirmPassword.trim().length > 0 &&
    subuserInviteForm.password === subuserInviteForm.confirmPassword;
  const isMembershipFormValid =
    membershipForm.description.trim().length > 0 &&
    membershipForm.owner.trim().length > 0 &&
    (Boolean(membershipForm.file) || Boolean(editingMembershipId));

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
    if (typeof cached.userProfilePicture === "string") {
      setUserProfilePicture(cached.userProfilePicture);
      setInitialUserProfilePicture(cached.userProfilePicture);
    }
    if (cached.companyDetails) {
      setCompanyDetails(cached.companyDetails);
      setInitialCompanyDetails(cached.companyDetails);
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
        let { data, error } = await (supabase as any)
          .from("profiles")
          .select("user_name, user_surname, user_email, user_contact, profile_picture")
          .eq("id", user.id)
          .maybeSingle();

        if (error && isUserProfilePictureColumnError(error)) {
          const fallback = await (supabase as any)
            .from("profiles")
            .select("user_name, user_surname, user_email, user_contact")
            .eq("id", user.id)
            .maybeSingle();
          data = fallback.data;
          error = fallback.error;
        }

        if (error) throw error;
        let nextUserDetails: UserDetailsForm | null = null;
        let nextUserProfilePicture = "";
        if (data) {
          nextUserDetails = {
            user_name: data.user_name || "",
            user_surname: data.user_surname || "",
            user_email: data.user_email || "",
            user_contact: data.user_contact || "",
          };
          nextUserProfilePicture = String((data as any).profile_picture || "").trim();
          setUserProfilePicture(nextUserProfilePicture);
          setInitialUserProfilePicture(nextUserProfilePicture);
        } else {
          const { data: subuserData } = await (supabase as any)
            .from("subusers")
            .select("name,surname,email,contact_number,user_name,user_surname,user_email,user_contact,phone_number,contact,profile_picture")
            .eq("auth_user_id", user.id)
            .maybeSingle();

          if (subuserData) {
            nextUserDetails = {
              user_name: String(subuserData.name ?? subuserData.user_name ?? "").trim(),
              user_surname: String(subuserData.surname ?? subuserData.user_surname ?? "").trim(),
              user_email: String(subuserData.email ?? subuserData.user_email ?? user.email ?? "").trim(),
              user_contact: String(
                subuserData.contact_number ?? subuserData.user_contact ?? subuserData.phone_number ?? subuserData.contact ?? "",
              ).trim(),
            };
            nextUserProfilePicture =
              String((subuserData as any).profile_picture || "").trim() || readCachedHeaderProfilePicture(user.id);
            setUserProfilePicture(nextUserProfilePicture);
            setInitialUserProfilePicture(nextUserProfilePicture);
          } else {
            const metaName = String((user as any)?.user_metadata?.user_name || (user as any)?.user_metadata?.name || "").trim();
            const metaSurname = String((user as any)?.user_metadata?.user_surname || (user as any)?.user_metadata?.surname || "").trim();
            const metaEmail = String((user as any)?.user_metadata?.user_email || user.email || "").trim();
            const metaContact = String(
              (user as any)?.user_metadata?.user_contact ||
              (user as any)?.user_metadata?.contact_number ||
              (user as any)?.user_metadata?.contact ||
              "",
            ).trim();
            nextUserDetails = {
              user_name: metaName,
              user_surname: metaSurname,
              user_email: metaEmail,
              user_contact: metaContact,
            };
            nextUserProfilePicture = readCachedHeaderProfilePicture(user.id);
            setUserProfilePicture("");
            setInitialUserProfilePicture(nextUserProfilePicture);
            setUserProfilePicture(nextUserProfilePicture);
          }
        }
        if (!nextUserDetails) return;

        setUserDetails(nextUserDetails);
        setInitialUserDetails(nextUserDetails);
        const nextCache = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
        nextCache.userDetails = nextUserDetails;
        nextCache.userProfilePicture = nextUserProfilePicture;
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

        if (error && !isCompanyProfileColumnError(error)) throw error;

        const physicalAddress = data?.physical_address
          ? parseAddressParts(data.physical_address)
          : {
              physical_address_line1: DEFAULT_PHYSICAL_ADDRESS_LINE1,
              physical_address_line2: DEFAULT_PHYSICAL_ADDRESS_LINE2,
              city: DEFAULT_CITY,
              province: DEFAULT_PROVINCE,
              area_code: DEFAULT_AREA_CODE,
            };
        const postalAddress = data?.postal_address
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

    } catch (error) {
      console.error("Failed to load settings profile group", group, error);
      if (!embedded) {
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive",
        });
      }
    } finally {
      loadingGroupsRef.current.delete(group);
      setGroupLoading(group, false);
    }
  }, [embedded, setGroupLoading, toast, user]);

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
      
      let error: unknown = null;
      if (isMasterUser) {
        let result = await (supabase as any)
          .from("profiles")
          .update({
            user_name: validated.userName,
            user_surname: validated.userSurname,
            user_email: validated.userEmail,
            user_contact: validated.userContact,
            profile_picture: userProfilePicture || null,
          })
          .eq("id", user.id);
        if (result.error && isUserProfilePictureColumnError(result.error)) {
          result = await (supabase as any)
            .from("profiles")
            .update({
              user_name: validated.userName,
              user_surname: validated.userSurname,
              user_email: validated.userEmail,
              user_contact: validated.userContact,
            })
            .eq("id", user.id);
        }
        error = result.error;
      } else {
        const result = await (supabase as any)
          .from("subusers")
          .update({
            name: validated.userName,
            surname: validated.userSurname,
            email: validated.userEmail,
            contact_number: validated.userContact,
            profile_picture: userProfilePicture || null,
          })
          .eq("auth_user_id", user.id);
        error = result.error;
      }

      if (error) throw error;

      setInitialUserDetails({
        user_name: validated.userName,
        user_surname: validated.userSurname,
        user_email: validated.userEmail,
        user_contact: validated.userContact,
      });
      setInitialUserProfilePicture(userProfilePicture);
      const cached = settingsProfileCacheByUser.get(user.id) ?? { loadedGroups: new Set<ProfileDataGroup>() };
      cached.userDetails = {
        user_name: validated.userName,
        user_surname: validated.userSurname,
        user_email: validated.userEmail,
        user_contact: validated.userContact,
      };
      cached.userProfilePicture = userProfilePicture;
      cached.loadedGroups.add("user");
      settingsProfileCacheByUser.set(user.id, cached);
      cacheHeaderProfile(user.id, {
        user_name: validated.userName,
        user_surname: validated.userSurname,
        user_email: validated.userEmail,
        profile_picture: userProfilePicture,
      });
      window.dispatchEvent(
        new CustomEvent("header-profile-updated", {
          detail: {
            user_name: validated.userName,
            user_surname: validated.userSurname,
            user_email: validated.userEmail,
            profile_picture: userProfilePicture,
          },
        }),
      );

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
    if (!canEditSettings) return;
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

  const isUserDirty =
    JSON.stringify(userDetails) !== JSON.stringify(initialUserDetails) ||
    userProfilePicture !== initialUserProfilePicture;
  const isCompanyProfileDirty = companyProfileKeys.some(
    (key) => companyDetails[key] !== initialCompanyDetails[key],
  );
  const isCompanyAddressDirty = companyAddressKeys.some(
    (key) => companyDetails[key] !== initialCompanyDetails[key],
  );
  const shouldShowAuthAction =
    passwordData.newPassword.trim().length > 0 || passwordData.confirmPassword.trim().length > 0;
  const isCurrentTabLoading = tabLoading[settingsTab];

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    navigate("/dashboard");
  };

  const handleSettingsTabChange = (nextTab: typeof settingsTab) => {
    setSettingsTab(nextTab);
    void ensureTabDataLoaded(nextTab);
  };

  const handleSubuserProfilePictureSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setSubuserInviteForm((prev) => ({ ...prev, profile_picture: dataUrl }));
      setSubuserProfilePictureName(file.name);
    } catch (error: any) {
      toast({
        title: "Profile picture failed",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleUserProfilePictureSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setUserProfilePicture(dataUrl);
    } catch (error: any) {
      toast({
        title: "Profile picture failed",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleSubuserInviteDialogChange = (open: boolean) => {
    if (open && !canEditSettings) return;
    setIsInviteSubuserOpen(open);
    if (!open) {
      setSubuserInviteForm(emptySubuserInviteForm);
      setSubuserProfilePictureName("");
      setSubuserInviteSubmitting(false);
      setSubuserInviteStep(1);
      setShowSubuserPassword(false);
      setShowSubuserConfirmPassword(false);
    }
  };
  const resetMembershipDialog = useCallback((organisation?: MembershipOrganisation) => {
    setMembershipForm(emptyMembershipForm(organisation));
    setEditingMembershipId(null);
    setMembershipSubmitting(false);
    if (membershipFileInputRef.current) membershipFileInputRef.current.value = "";
  }, []);
  const handleMembershipDialogChange = useCallback((open: boolean) => {
    setIsMembershipDialogOpen(open);
    if (!open) resetMembershipDialog();
  }, [resetMembershipDialog]);
  const openCreateMembershipDialog = useCallback((organisation: MembershipOrganisation) => {
    if (!canEditSettings) return;
    resetMembershipDialog(organisation);
    setIsMembershipDialogOpen(true);
  }, [canEditSettings, resetMembershipDialog]);
  const openEditMembershipDialog = useCallback((membership: MembershipListItem) => {
    if (!canEditSettings) return;
    setMembershipForm({
      organisation: membership.organisation,
      description: membership.description,
      owner: membership.owner,
      file: null,
      fileName: membership.file_name,
    });
    setEditingMembershipId(membership.id);
    setMembershipSubmitting(false);
    if (membershipFileInputRef.current) membershipFileInputRef.current.value = "";
    setIsMembershipDialogOpen(true);
  }, [canEditSettings]);
  const fetchMembershipsList = useCallback(async () => {
    setMembershipsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("llasa_memberships")
        .select("id,organisation,description,owner,file_name,storage_path,created_at,updated_at")
        .order("created_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      const normalized = ((data ?? []) as any[])
        .map((row) => {
          const organisation = normalizeMembershipOrganisation(row.organisation);
          if (!organisation) return null;
          return {
            id: String(row.id ?? ""),
            organisation,
            description: String(row.description ?? "").trim(),
            owner: String(row.owner ?? "").trim(),
            file_name: String(row.file_name ?? "").trim(),
            storage_path: String(row.storage_path ?? "").trim(),
            created_at: row.created_at ?? null,
            updated_at: row.updated_at ?? null,
          } satisfies MembershipListItem;
        })
        .filter((row): row is MembershipListItem => Boolean(row));

      setMembershipsList(normalized);
    } catch (error: any) {
      toast({
        title: "Unable to load memberships",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      setMembershipsList([]);
    } finally {
      setMembershipsLoading(false);
    }
  }, [toast]);
  const fetchSubusersList = useCallback(async () => {
    if (!user?.id) return;
    setSubusersLoading(true);
    try {
      let { data, error } = await (supabase as any)
        .from("subusers")
        .select("id,auth_user_id,invited_by,name,surname,contact_number,email,role,profile_picture,status,created_at")
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
      const rawRows = (data ?? []) as any[];
      const normalized = rawRows.map((row) => ({
        id: String(row.id ?? row.auth_user_id ?? `${row.email ?? "subuser"}-${row.created_at ?? ""}`),
        auth_user_id: String(row.auth_user_id ?? "").trim() || null,
        name: String(row.name ?? row.user_name ?? "").trim(),
        surname: String(row.surname ?? row.user_surname ?? row.last_name ?? "").trim(),
        contact_number: String(row.contact_number ?? row.contact ?? row.phone_number ?? "").trim(),
        email: String(row.email ?? "").trim(),
        role: String(row.role ?? row.user_role ?? "").trim(),
        profile_picture: String(row.profile_picture ?? "").trim() || null,
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
  const handleDeleteSubuser = useCallback(
    async (subuser: SubuserListItem) => {
      if (!isMasterUser) return;
      const fullName = `${subuser.name || ""} ${subuser.surname || ""}`.trim() || subuser.email || "this subuser";
      const confirmed = window.confirm(
        `Are you sure you want to delete ${fullName}? This will remove the account from subusers and auth users.`,
      );
      if (!confirmed) return;

      setDeletingSubuserId(subuser.id);
      try {
        const { data, error } = await supabase.functions.invoke("delete-subuser-manual", {
          body: {
            subuser_id: subuser.id,
            auth_user_id: subuser.auth_user_id ?? undefined,
            email: subuser.email ?? undefined,
          },
        });
        const response = (data ?? null) as { ok?: boolean; error?: string; partial?: boolean; auth_deleted?: boolean } | null;
        if (error) throw error;
        if (!response?.ok) {
          throw new Error(response?.error || "Delete failed.");
        }
        toast({
          title: "Subuser deleted",
          description: response.auth_deleted === false ? "Subuser row deleted. Auth user was not linked." : "Subuser removed successfully.",
        });
        await fetchSubusersList();
      } catch (error: any) {
        toast({
          title: "Delete failed",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setDeletingSubuserId(null);
      }
    },
    [fetchSubusersList, isMasterUser, toast],
  );
  const handleMembershipFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMembershipForm((prev) => ({
      ...prev,
      file,
      fileName: file.name,
    }));
  }, []);
  const handleViewMembership = useCallback(async (membership: MembershipListItem) => {
    setViewingMembershipId(membership.id);
    try {
      const { data, error } = await supabase.storage
        .from(LLASA_MEMBERSHIPS_BUCKET)
        .createSignedUrl(membership.storage_path, 300);
      if (error || !data?.signedUrl) throw error || new Error("Signed URL failed.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast({
        title: "Unable to open certificate",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setViewingMembershipId(null);
    }
  }, [toast]);
  const handleDeleteMembership = useCallback(async (membership: MembershipListItem) => {
    if (!canEditSettings) return;
    const confirmed = window.confirm(`Delete the ${membership.organisation} membership certificate "${membership.description}"?`);
    if (!confirmed) return;

    setDeletingMembershipId(membership.id);
    try {
      const { error: deleteRowError } = await (supabase as any)
        .from("llasa_memberships")
        .delete()
        .eq("id", membership.id);
      if (deleteRowError) throw deleteRowError;

      if (membership.storage_path) {
        await supabase.storage.from(LLASA_MEMBERSHIPS_BUCKET).remove([membership.storage_path]);
      }

      setMembershipsList((prev) => prev.filter((item) => item.id !== membership.id));
      toast({
        title: "Membership deleted",
        description: "Certificate removed successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeletingMembershipId(null);
    }
  }, [canEditSettings, toast]);
  const handleMembershipSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id) return;
    if (!canEditSettings) return;
    if (!isMembershipFormValid) return;

    const existingMembership = editingMembershipId
      ? membershipsList.find((item) => item.id === editingMembershipId) ?? null
      : null;

    setMembershipSubmitting(true);
    let uploadedStoragePath = "";

    try {
      let storagePath = existingMembership?.storage_path || "";
      let fileName = existingMembership?.file_name || membershipForm.fileName.trim();

      if (membershipForm.file) {
        const safeName = membershipForm.file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
        uploadedStoragePath = `${user.id}/${slugifyMembershipOrganisation(membershipForm.organisation)}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(LLASA_MEMBERSHIPS_BUCKET)
          .upload(uploadedStoragePath, membershipForm.file, {
            upsert: false,
            contentType: membershipForm.file.type || "application/octet-stream",
          });
        if (uploadError) throw uploadError;
        storagePath = uploadedStoragePath;
        fileName = membershipForm.file.name;
      }

      const payload = {
        organisation: membershipForm.organisation,
        description: membershipForm.description.trim(),
        owner: membershipForm.owner.trim(),
        file_name: fileName,
        storage_path: storagePath,
        uploaded_by: user.id,
      };

      if (!payload.storage_path || !payload.file_name) {
        throw new Error("A certificate file is required.");
      }

      if (editingMembershipId) {
        const { error } = await (supabase as any)
          .from("llasa_memberships")
          .update(payload)
          .eq("id", editingMembershipId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("llasa_memberships")
          .insert(payload);
        if (error) throw error;
      }

      if (
        uploadedStoragePath &&
        existingMembership?.storage_path &&
        existingMembership.storage_path !== uploadedStoragePath
      ) {
        await supabase.storage.from(LLASA_MEMBERSHIPS_BUCKET).remove([existingMembership.storage_path]);
      }

      toast({
        title: editingMembershipId ? "Membership updated" : "Membership added",
        description: editingMembershipId
          ? "Certificate details updated successfully."
          : "Certificate uploaded successfully.",
      });
      await fetchMembershipsList();
      handleMembershipDialogChange(false);
    } catch (error: any) {
      if (uploadedStoragePath) {
        await supabase.storage.from(LLASA_MEMBERSHIPS_BUCKET).remove([uploadedStoragePath]);
      }
      toast({
        title: "Membership save failed",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setMembershipSubmitting(false);
    }
  }, [
    editingMembershipId,
    fetchMembershipsList,
    handleMembershipDialogChange,
    canEditSettings,
    isMembershipFormValid,
    membershipForm,
    membershipsList,
    toast,
    user?.id,
  ]);

  const handleSubuserInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEditSettings) return;
    if (subuserInviteStep === 1) {
      if (!isSubuserStepOneComplete) return;
      setSubuserInviteStep(2);
      return;
    }
    if (subuserInviteStep === 2) {
      setSubuserInviteStep(3);
      return;
    }
    if (!isSubuserStepThreeComplete) return;
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
      profile_picture: subuserInviteForm.profile_picture.trim(),
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

  useEffect(() => {
    if (!user) return;
    if (settingsTab !== "subusers") return;
    void fetchSubusersList();
  }, [fetchSubusersList, settingsTab, user]);
  useEffect(() => {
    if (!user) return;
    if (settingsTab !== "memberships") return;
    void fetchMembershipsList();
  }, [fetchMembershipsList, settingsTab, user]);
  useEffect(() => {
    let isCancelled = false;
    const resolvePermissions = async () => {
      if (!user?.id) {
        if (!isCancelled) {
          setIsMasterUser(false);
          setIsPermissionsLoading(false);
        }
        return;
      }
      setIsPermissionsLoading(true);
      try {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        if (!isCancelled) {
          setIsMasterUser(Boolean(profileRow?.id));
        }
      } catch {
        if (!isCancelled) setIsMasterUser(false);
      } finally {
        if (!isCancelled) setIsPermissionsLoading(false);
      }
    };
    void resolvePermissions();
    return () => {
      isCancelled = true;
    };
  }, [user?.id]);
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
                {visibleSettingsTabs.map((tab) => {
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
            <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm bg-white px-4 py-3 text-[11px] text-slate-700 [&_.text-muted-foreground]:!text-slate-500 [&_input]:h-[34px] [&_input]:w-full [&_input]:rounded [&_input]:border-[0.5px] [&_input]:border-slate-400 [&_input]:bg-white [&_input]:px-3 [&_input]:text-[11px] [&_input]:font-medium [&_input]:text-slate-900 [&_input]:shadow-none [&_input]:placeholder:text-[10px] [&_input]:placeholder:text-slate-400 [&_input:hover]:border-[#3eca44] [&_input]:focus-visible:border-slate-300 [&_input]:focus-visible:ring-0 [&_input]:focus-visible:ring-offset-0 [&_[role=combobox]]:h-[34px] [&_[role=combobox]]:w-full [&_[role=combobox]]:rounded [&_[role=combobox]]:border-[0.5px] [&_[role=combobox]]:border-slate-400 [&_[role=combobox]]:bg-white [&_[role=combobox]]:px-3 [&_[role=combobox]]:text-[11px] [&_[role=combobox]]:font-medium [&_[role=combobox]]:text-slate-900 [&_[role=combobox]]:shadow-none [&_[role=combobox]:hover]:border-[#3eca44] [&_[role=combobox]]:focus:border-[#3eca44] [&_[role=combobox]]:focus-visible:border-[#3eca44] [&_[role=combobox]]:focus-visible:ring-0 [&_[role=combobox]]:focus-visible:ring-offset-0 [&_[role=combobox]]:data-[state=open]:border-[#3eca44]">
              {isPermissionsLoading || isCurrentTabLoading ? (
                <div className="flex h-full items-center justify-center">
                  <img src="/llasa_thumbnail.png" alt="Loading tab" className="h-10 w-10 animate-spin" style={{ animationDuration: "2s" }} />
                </div>
              ) : (
                <>
              {settingsTab === "user" && (
            <div className={`flex ${settingsTabScrollPaneClass} flex-col space-y-5`}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-[20px] font-semibold text-[#2D4256]">User Details</h3>
                  <p className="mb-2 text-[11px] text-slate-500">Update your personal information</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-7">
                <div className="space-y-1 pt-1">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Profile Picture</h4>
                  <div className="h-[0.5px] w-full bg-[#3eca44]" />
                </div>
                <div className="space-y-1">
                  <input
                    ref={userProfilePictureInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleUserProfilePictureSelect}
                  />
                  <div className="relative flex w-fit items-center justify-center">
                    <Avatar className="h-32 w-32 border border-slate-200">
                      <AvatarImage src={userProfilePicture || undefined} alt="User profile picture" className="object-cover" />
                      <AvatarFallback className="bg-[#eef9ef] text-[22px] font-semibold text-[#2f9f35]">
                        {getInitials(userDetails.user_name, userDetails.user_surname)}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      type="button"
                      variant="outline"
                      className="absolute bottom-1.5 left-1.5 h-6 w-6 rounded-full border-slate-300 bg-white/95 p-0 text-slate-600 hover:bg-white/95 hover:border-[#3eca44] hover:text-[#2f9f35]"
                      onClick={() => userProfilePictureInputRef.current?.click()}
                    >
                      {userProfilePicture ? <Pencil className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
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
            <div className={`flex ${settingsTabScrollPaneClass} flex-col space-y-4`}>
              <div className="space-y-1">
                <h3 className="text-[20px] font-semibold text-[#2D4256]">Subusers</h3>
                <p className="mb-2 text-[11px] text-slate-500">
                  {isMasterUser
                    ? "Here, the main user can create and manage active subusers."
                    : "You can view active subusers. Only the main user can create subusers."}
                </p>
              </div>
              {isMasterUser ? (
                <div className={settingsActionRowClass.replace("justify-center", "justify-start")}>
                  <Button
                    type="button"
                    onClick={() => setIsInviteSubuserOpen(true)}
                    className={popupActionButtonClass}
                  >
                    Add Subuser
                  </Button>
                </div>
              ) : null}
                <div className="overflow-hidden rounded border border-slate-200">
                <div className={`grid ${isMasterUser ? "grid-cols-[1.25fr_1.35fr_1.1fr_0.9fr_0.55fr]" : "grid-cols-[1.4fr_1.4fr_1.2fr_1fr]"} items-center gap-2 bg-[#2D4256] px-3 py-2 text-[10px] font-semibold text-white`}>
                  <div>Name</div>
                  <div>Email</div>
                  <div>Contact Number</div>
                  <div>Role</div>
                  {isMasterUser ? <div className="text-center">Actions</div> : null}
                </div>
                <div className="max-h-[330px] divide-y overflow-y-auto bg-white text-[11px]">
                  {subusersLoading ? (
                    <div className="px-3 py-3 text-slate-500">Loading subusers...</div>
                  ) : subusersList.length === 0 ? (
                    <div className="px-3 py-3 text-slate-500">No active subusers found.</div>
                  ) : (
                    subusersList.map((item) => (
                      <div key={item.id} className={`grid ${isMasterUser ? "grid-cols-[1.25fr_1.35fr_1.1fr_0.9fr_0.55fr]" : "grid-cols-[1.4fr_1.4fr_1.2fr_1fr]"} items-center gap-2 px-3 py-2 hover:bg-[#3eca44]/5`}>
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="h-7 w-7 shrink-0 rounded-full border border-slate-200">
                            <AvatarImage src={item.profile_picture || undefined} alt={`${item.name || ""} ${item.surname || ""}`.trim() || "Subuser"} className="object-cover" />
                            <AvatarFallback className="bg-[#eef9ef] text-[10px] font-semibold text-[#2f9f35]">
                              {getInitials(item.name, item.surname)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="truncate text-slate-900">{`${item.name || ""} ${item.surname || ""}`.trim() || "--"}</div>
                        </div>
                        <div className="truncate text-slate-700">{item.email || "--"}</div>
                        <div className="truncate text-slate-700">{item.contact_number || "--"}</div>
                        <div className="truncate text-slate-700">{item.role || "--"}</div>
                        {isMasterUser ? (
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => void handleDeleteSubuser(item)}
                              disabled={deletingSubuserId === item.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#f0b5b5] bg-white text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Delete subuser ${item.email || item.name || item.id}`}
                            >
                              {deletingSubuserId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
              )}

              {settingsTab === "memberships" && (
            <div className={`flex ${settingsTabScrollPaneClass} flex-col space-y-4`}>
                <div className="space-y-1">
                  <h3 className="text-[20px] font-semibold text-[#2D4256]">Memberships</h3>
                  <p className="mb-2 text-[11px] text-slate-500">
                    Upload and manage LLASA and/or its employees'membership certificates.
                  </p>
                </div>
              {canEditSettings ? (
                <div className={settingsActionRowClass.replace("mt-auto ", "").replace("justify-center", "justify-start")}>
                  <Button
                    type="button"
                    onClick={() => openCreateMembershipDialog("AHI Employers Organisation")}
                    className={popupActionButtonClass}
                  >
                    Add Membership
                  </Button>
                </div>
              ) : null}
              <div className="overflow-hidden rounded border border-slate-200">
                <div className="grid grid-cols-[1.8fr_1.2fr_0.8fr] items-center gap-2 bg-[#2D4256] px-3 py-2 text-[10px] font-semibold text-white">
                  <div>Description</div>
                  <div>Owner</div>
                  <div className="text-center">Actions</div>
                </div>
                <div className="max-h-[330px] divide-y overflow-y-auto bg-white text-[11px]">
                  {membershipsLoading ? (
                    <div className="px-3 py-3 text-slate-500">Loading memberships...</div>
                  ) : membershipsList.length === 0 ? (
                    <div className="px-3 py-3 text-slate-500">No certificates uploaded.</div>
                  ) : (
                    membershipsList.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1.8fr_1.2fr_0.8fr] items-center gap-2 px-3 py-2 hover:bg-[#3eca44]/5">
                        <div className="truncate text-slate-900">{item.description || "--"}</div>
                        <div className="truncate text-slate-700">{item.owner || "--"}</div>
                        {canEditSettings ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleViewMembership(item)}
                              disabled={viewingMembershipId === item.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded bg-transparent text-slate-500 transition-colors hover:text-[#2f9f35] disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`View ${item.organisation} certificate`}
                            >
                              {viewingMembershipId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditMembershipDialog(item)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded bg-transparent text-slate-500 transition-colors hover:text-[#2f9f35]"
                              aria-label={`Edit ${item.organisation} certificate`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteMembership(item)}
                              disabled={deletingMembershipId === item.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded bg-transparent text-slate-500 transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Delete ${item.organisation} certificate`}
                            >
                              {deletingMembershipId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-start">
                            <button
                              type="button"
                              onClick={() => void handleViewMembership(item)}
                              disabled={viewingMembershipId === item.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded bg-transparent text-slate-500 transition-colors hover:text-[#2f9f35] disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`View ${item.organisation} certificate`}
                            >
                              {viewingMembershipId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
              )}

              {settingsTab === "company" && (
            <div className={`flex ${settingsTabScrollPaneClass} flex-col space-y-5`}>
              <div className="space-y-1">
                <h3 className="text-[20px] font-semibold text-[#2D4256]">Company Profile</h3>
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
                      readOnly={!canEditSettings}
                      tabIndex={canEditSettings ? 0 : -1}
                      className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                      onChange={(e) => setCompanyDetails((prev) => ({ ...prev, company_name: e.target.value }))}
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Trading as</span>
                    <Input
                      id="company_type"
                      value={companyDetails.company_type}
                      readOnly={!canEditSettings}
                      tabIndex={canEditSettings ? 0 : -1}
                      className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                      onChange={(e) => setCompanyDetails((prev) => ({ ...prev, company_type: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Registration Number</span>
                    <Input
                      id="registration_number"
                      value={companyDetails.registration_number}
                      readOnly={!canEditSettings}
                      tabIndex={canEditSettings ? 0 : -1}
                      className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                      onChange={(e) => setCompanyDetails((prev) => ({ ...prev, registration_number: e.target.value }))}
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>VAT Number</span>
                    <Input
                      id="vat_number"
                      value={companyDetails.vat_number}
                      readOnly={!canEditSettings}
                      tabIndex={canEditSettings ? 0 : -1}
                      className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                      onChange={(e) => setCompanyDetails((prev) => ({ ...prev, vat_number: e.target.value }))}
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
                      readOnly={!canEditSettings}
                      tabIndex={canEditSettings ? 0 : -1}
                      className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                      onChange={(e) => setCompanyDetails((prev) => ({ ...prev, company_contact: e.target.value }))}
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Company Email</span>
                    <Input
                      id="company_email"
                      type="email"
                      value={companyDetails.company_email}
                      readOnly={!canEditSettings}
                      tabIndex={canEditSettings ? 0 : -1}
                      className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                      onChange={(e) => setCompanyDetails((prev) => ({ ...prev, company_email: e.target.value }))}
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
                      readOnly={!canEditSettings}
                      tabIndex={canEditSettings ? 0 : -1}
                      className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                      onChange={(e) => setCompanyDetails((prev) => ({ ...prev, representative_name: e.target.value }))}
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Representative Last Name</span>
                    <Input
                      id="representative_surname"
                      value={companyDetails.representative_surname}
                      readOnly={!canEditSettings}
                      tabIndex={canEditSettings ? 0 : -1}
                      className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                      onChange={(e) => setCompanyDetails((prev) => ({ ...prev, representative_surname: e.target.value }))}
                    />
                  </div>
                </div>
                {canEditSettings && isCompanyProfileDirty ? (
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
            <div className={`flex ${settingsTabScrollPaneClass} flex-col space-y-5`}>
              <div className="space-y-1">
                <h3 className="text-[20px] font-semibold text-[#2D4256]">Company Address</h3>
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
                        readOnly={!canEditSettings}
                        tabIndex={canEditSettings ? 0 : -1}
                        className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                        onChange={(e) => setCompanyDetails((prev) => ({ ...prev, physical_address_line1: e.target.value }))}
                      />
                    </div>
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Address Line 1</span>
                      <Input
                        id="postal_address_line1"
                        value={companyDetails.postal_address_line1}
                        readOnly={!canEditSettings}
                        tabIndex={canEditSettings ? 0 : -1}
                        className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                        onChange={(e) => setCompanyDetails((prev) => ({ ...prev, postal_address_line1: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Address Line 2</span>
                      <Input
                        id="physical_address_line2"
                        value={companyDetails.physical_address_line2}
                        readOnly={!canEditSettings}
                        tabIndex={canEditSettings ? 0 : -1}
                        className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                        onChange={(e) => setCompanyDetails((prev) => ({ ...prev, physical_address_line2: e.target.value }))}
                      />
                    </div>
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Address Line 2</span>
                      <Input
                        id="postal_address_line2"
                        value={companyDetails.postal_address_line2}
                        readOnly={!canEditSettings}
                        tabIndex={canEditSettings ? 0 : -1}
                        className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                        onChange={(e) => setCompanyDetails((prev) => ({ ...prev, postal_address_line2: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>City</span>
                      <Input
                        id="city"
                        value={companyDetails.city}
                        readOnly={!canEditSettings}
                        tabIndex={canEditSettings ? 0 : -1}
                        className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                        onChange={(e) => setCompanyDetails((prev) => ({ ...prev, city: e.target.value }))}
                      />
                    </div>
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>City</span>
                      <Input
                        id="postal_city"
                        value={companyDetails.postal_city}
                        readOnly={!canEditSettings}
                        tabIndex={canEditSettings ? 0 : -1}
                        className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                        onChange={(e) => setCompanyDetails((prev) => ({ ...prev, postal_city: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Province</span>
                      <Input
                        id="province"
                        value={companyDetails.province}
                        readOnly={!canEditSettings}
                        tabIndex={canEditSettings ? 0 : -1}
                        className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                        onChange={(e) => setCompanyDetails((prev) => ({ ...prev, province: e.target.value }))}
                      />
                    </div>
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Province</span>
                      <Input
                        id="postal_province"
                        value={companyDetails.postal_province}
                        readOnly={!canEditSettings}
                        tabIndex={canEditSettings ? 0 : -1}
                        className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                        onChange={(e) => setCompanyDetails((prev) => ({ ...prev, postal_province: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Area Code</span>
                      <Input
                        id="area_code"
                        value={companyDetails.area_code}
                        readOnly={!canEditSettings}
                        tabIndex={canEditSettings ? 0 : -1}
                        className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                        onChange={(e) => setCompanyDetails((prev) => ({ ...prev, area_code: e.target.value }))}
                      />
                    </div>
                    <div className="relative w-full max-w-none">
                      <span className={floatingLabelClass}>Postal Code</span>
                      <Input
                        id="postal_area_code"
                        value={companyDetails.postal_area_code}
                        readOnly={!canEditSettings}
                        tabIndex={canEditSettings ? 0 : -1}
                        className={canEditSettings ? "" : companyProfileReadOnlyInputClass}
                        onChange={(e) => setCompanyDetails((prev) => ({ ...prev, postal_area_code: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                {canEditSettings && isCompanyAddressDirty ? (
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
            <div className={`flex ${settingsTabScrollPaneClass} flex-col space-y-5`}>
              <div className="space-y-1">
                <h3 className="text-[20px] font-semibold text-[#2D4256]">Authentication</h3>
                <p className="mb-2 text-[11px] text-slate-500">Change your password here whenever you need to keep your account secure.</p>
              </div>
              <div className="flex flex-1 flex-col gap-7">
                <div className="space-y-1 pt-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Username</h4>
                  <div className="h-[0.5px] w-full bg-[#3eca44]" />
                </div>
                <div className="grid max-w-[760px] grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Username</span>
                    <Input
                      id="auth_username"
                      value={authUsernameDisplay}
                      readOnly
                      tabIndex={-1}
                      className={companyProfileReadOnlyInputClass}
                    />
                  </div>
                </div>
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

                </>
              )}
            </section>

            <Dialog open={isMembershipDialogOpen} onOpenChange={handleMembershipDialogChange}>
              <DialogContent
                className="w-[94vw] max-w-[420px] gap-0 overflow-hidden rounded-sm border-0 bg-[#2D4256] p-0 sm:rounded-sm [&>button]:hidden"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <div className="relative">
                  <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                    <div className="flex items-center gap-2 pl-2">
                      <FileText className="h-4 w-4 text-white" />
                      <DialogTitle className="text-sm font-semibold text-white">
                        {editingMembershipId ? "Edit Membership" : "Add Membership"}
                      </DialogTitle>
                    </div>
                    <DialogClose asChild>
                      <button type="button" className="text-white hover:text-white/80" aria-label="Close membership popup">
                        <X className="h-4 w-4" />
                      </button>
                    </DialogClose>
                  </div>
                  <div className="mt-[46px] bg-white px-6 pb-6 pt-5">
                    <form onSubmit={handleMembershipSubmit} className="space-y-4">
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Organisation</span>
                        <Select
                          value={membershipForm.organisation}
                          onValueChange={(value) =>
                            setMembershipForm((prev) => ({ ...prev, organisation: value as MembershipOrganisation }))
                          }
                        >
                          <SelectTrigger className="h-8 w-full justify-between rounded px-3 text-[11px] inline-flex items-center border border-slate-300 bg-white text-slate-900 hover:border-slate-500 data-[state=open]:rounded-b-none data-[state=open]:border-black data-[state=open]:bg-white data-[state=open]:text-slate-900 !ring-0 !ring-offset-0 focus:!border-black focus:!ring-0 focus:!ring-offset-0 focus-visible:!border-black focus-visible:!ring-0 focus-visible:!ring-offset-0">
                            <SelectValue placeholder="Select organisation" />
                          </SelectTrigger>
                          <SelectContent className="rounded text-[11px]">
                            {membershipOrganisations.map((organisation) => (
                              <SelectItem
                                key={organisation}
                                value={organisation}
                                className="text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]"
                              >
                                {organisation}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Description <span className="text-red-600">*</span></span>
                        <Input
                          value={membershipForm.description}
                          onChange={(event) => setMembershipForm((prev) => ({ ...prev, description: event.target.value }))}
                          className={subuserModalInputClass}
                          placeholder="Please insert description"
                          required
                        />
                      </div>
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Owner <span className="text-red-600">*</span></span>
                        <Input
                          value={membershipForm.owner}
                          onChange={(event) => setMembershipForm((prev) => ({ ...prev, owner: event.target.value }))}
                          className={subuserModalInputClass}
                          placeholder="Please insert owner"
                          required
                        />
                      </div>
                      <input
                        ref={membershipFileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        className="hidden"
                        onChange={handleMembershipFileSelect}
                      />
                      <div className="rounded border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-slate-900">
                              {membershipForm.fileName || "No certificate selected"}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {editingMembershipId ? "Upload a new file only if you want to replace the existing certificate." : "PDF and image files are supported."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-[28px] rounded border-slate-300 bg-white px-3 text-xs text-slate-600 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
                            onClick={() => membershipFileInputRef.current?.click()}
                          >
                            {editingMembershipId ? "Replace File" : "Upload File"}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-[28px] w-[90px] rounded border-slate-300 bg-white px-3 text-xs text-slate-600 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
                          onClick={() => handleMembershipDialogChange(false)}
                          disabled={membershipSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="h-[28px] min-w-[110px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b] disabled:bg-slate-300 disabled:text-white"
                          disabled={membershipSubmitting || !isMembershipFormValid}
                        >
                          {membershipSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {editingMembershipId ? "Save" : "Upload"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

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
                    <div className="relative grid grid-cols-3 items-start">
                      <div className="pointer-events-none absolute left-[calc(16.666%+18px)] top-[10px] h-[2px] w-[calc(66.666%-36px)] bg-slate-300" />
                      {subuserInviteStep > 1 ? <div className="pointer-events-none absolute left-[calc(16.666%+18px)] top-[10px] h-[2px] w-[calc(33.333%-18px)] bg-[#3eca44]" /> : null}
                      {subuserInviteStep > 2 ? <div className="pointer-events-none absolute left-[50%] top-[10px] h-[2px] w-[calc(33.333%-18px)] bg-[#3eca44]" /> : null}
                      {[{ step: 1 as const, label: "Details" }, { step: 2 as const, label: "Profile Picture" }, { step: 3 as const, label: "Authentication" }].map((item) => {
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
                  ) : subuserInviteStep === 2 ? (
                    <div className="w-full space-y-4">
                      <input
                        ref={subuserProfilePictureInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleSubuserProfilePictureSelect}
                      />
                      <div className="flex flex-col items-center gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-5">
                        <Avatar className="h-24 w-24 border border-slate-200">
                          <AvatarImage src={subuserInviteForm.profile_picture || undefined} alt="Subuser profile picture preview" />
                          <AvatarFallback className="bg-[#eef9ef] text-[20px] font-semibold text-[#2f9f35]">
                            {getInitials(subuserInviteForm.name, subuserInviteForm.surname)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1 text-center">
                          <p className="text-[11px] font-medium text-slate-900">
                            {subuserProfilePictureName || "Upload a profile picture"}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Add an optional profile picture for this user.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-[28px] rounded border-slate-300 bg-white px-3 text-xs text-slate-600 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
                            onClick={() => subuserProfilePictureInputRef.current?.click()}
                          >
                            {subuserInviteForm.profile_picture ? "Change Picture" : "Upload Picture"}
                          </Button>
                          {subuserInviteForm.profile_picture ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-[28px] rounded border-slate-300 bg-white px-3 text-xs text-slate-600 hover:border-rose-500 hover:bg-white hover:text-rose-600"
                              onClick={() => {
                                setSubuserInviteForm((prev) => ({ ...prev, profile_picture: "" }));
                                setSubuserProfilePictureName("");
                                if (subuserProfilePictureInputRef.current) subuserProfilePictureInputRef.current.value = "";
                              }}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
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
                        if (subuserInviteStep === 3) {
                          setSubuserInviteStep(2);
                          return;
                        }
                        if (subuserInviteStep === 2) {
                          setSubuserInviteStep(1);
                          return;
                        }
                        handleSubuserInviteDialogChange(false);
                      }}
                      disabled={subuserInviteSubmitting}
                    >
                      {subuserInviteStep > 1 ? "Back" : "Cancel"}
                    </Button>
                    <Button
                      type="submit"
                      className="h-[28px] w-[90px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b] disabled:bg-slate-300 disabled:text-white"
                      disabled={
                        subuserInviteSubmitting ||
                        (subuserInviteStep === 1
                          ? !isSubuserStepOneComplete
                          : subuserInviteStep === 2
                            ? !isSubuserStepTwoComplete
                            : !isSubuserStepThreeComplete)
                      }
                    >
                      {subuserInviteSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {subuserInviteStep === 3 ? "Submit" : "Next"}
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

  return content;
};

export default Settings;






