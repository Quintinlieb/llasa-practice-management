import { useState, useEffect, useRef } from "react";
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
import { Loader2, Eye, EyeOff, Plus, X, User, UserPlus, Users, Building2, Lock, FileText, Palette, SlidersHorizontal, MapPin, Settings as SettingsIcon, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { z } from "zod";
import { companySetupBaseSchema, companySetupSchema, southAfricanProvinces } from "@/lib/validation";
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
};

const emptyUserDetails: UserDetailsForm = {
  user_name: "",
  user_surname: "",
  user_email: "",
  user_contact: "",
};

const emptyCompanyDetails: CompanyDetailsForm = {
  company_type: "",
  company_name: "",
  registration_number: "",
  vat_number: "",
  physical_address_line1: "",
  physical_address_line2: "",
  city: "",
  province: "",
  area_code: "",
  postal_address_line1: "",
  postal_address_line2: "",
  postal_city: "",
  postal_province: "",
  postal_area_code: "",
  representative_name: "",
  representative_surname: "",
  company_contact: "",
  company_email: "",
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
};

const Settings = ({ embedded = false, onClose }: SettingsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
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
  const [branchEditMode, setBranchEditMode] = useState(false);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [branchSearchQuery, setBranchSearchQuery] = useState("");
  const [branchSearchFocused, setBranchSearchFocused] = useState(false);
  const [branchSaving, setBranchSaving] = useState(false);

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordError, setPasswordError] = useState("");
  const [settingsTab, setSettingsTab] = useState<"user" | "subusers" | "company" | "companyAddress" | "companySetup" | "auth" | "plan" | "personalize">("user");
  const [personaliseLogoLayout, setPersonaliseLogoLayout] = useState<"vertical" | "horizontal" | null>(null);
  const [personaliseLogoPreview, setPersonaliseLogoPreview] = useState("");
  const [initialPersonaliseLogoLayout, setInitialPersonaliseLogoLayout] = useState<"vertical" | "horizontal" | null>(null);
  const [initialPersonaliseLogoPreview, setInitialPersonaliseLogoPreview] = useState("");
  const [personaliseLogoName, setPersonaliseLogoName] = useState("");
  const [isInviteSubuserOpen, setIsInviteSubuserOpen] = useState(false);
  const [subuserInviteForm, setSubuserInviteForm] = useState<SubuserInviteForm>(emptySubuserInviteForm);
  const [subuserInviteSubmitting, setSubuserInviteSubmitting] = useState(false);
  const personaliseLogoInputRef = useRef<HTMLInputElement | null>(null);

  const settingsTabs: Array<{ value: "user" | "subusers" | "company" | "companyAddress" | "companySetup" | "auth" | "plan" | "personalize"; label: string; icon: LucideIcon }> = [
    { value: "user", label: "User Details", icon: User },
    { value: "subusers", label: "Subusers", icon: Users },
    { value: "company", label: "Company Profile", icon: Building2 },
    { value: "companyAddress", label: "Company Address", icon: MapPin },
    { value: "companySetup", label: "Company Setup", icon: SlidersHorizontal },
    { value: "auth", label: "Authentication", icon: Lock },
    { value: "plan", label: "Subscription", icon: FileText },
    { value: "personalize", label: "Personalise", icon: Palette },
  ];
  const popupActionButtonClass =
    "h-8 min-w-[108px] rounded px-3 text-[11px] inline-flex items-center justify-center border border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-blue-600";
  const subuserModalInputClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !h-[34px] !border-[0.5px] !border-slate-400 !focus-visible:border-slate-300";
  const floatingLabelClass =
    "pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold leading-none text-slate-400";
  const settingsActionRowClass = "mt-auto flex justify-center border-t border-slate-100 bg-white pt-3 pb-1";
  const isSubuserInviteFormComplete =
    subuserInviteForm.name.trim().length > 0 &&
    subuserInviteForm.surname.trim().length > 0 &&
    subuserInviteForm.contact_number.trim().length > 0 &&
    subuserInviteForm.email.trim().length > 0;

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const baseProfileSelect =
      "user_name, user_surname, user_email, user_contact, company_type, company_name, registration_number, vat_number, physical_address, postal_address, representative_name, representative_surname, company_contact, company_email, branches_enabled, branches";
    const profileSelectWithPersonalise = `${baseProfileSelect}, company_logo_data_url, company_logo_layout`;

    const withPersonalise = await (supabase as any)
      .from("profiles")
      .select(profileSelectWithPersonalise)
      .eq("id", user.id)
      .maybeSingle();
    const fallbackWithoutPersonalise = withPersonalise.error
      ? await (supabase as any)
          .from("profiles")
          .select(baseProfileSelect)
          .eq("id", user.id)
          .maybeSingle()
      : null;
    const data = withPersonalise.error ? fallbackWithoutPersonalise?.data : withPersonalise.data;
    const error = withPersonalise.error ? fallbackWithoutPersonalise?.error : withPersonalise.error;

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } else if (data) {
      const addressParts = (data.physical_address || "")
        .split(/,\s*/)
        .map((part) => part.trim())
        .filter(Boolean);
      const postalAddressParts = (data.postal_address || "")
        .split(/,\s*/)
        .map((part) => part.trim())
        .filter(Boolean);
      const hasFourParts = addressParts.length === 4;
      const postalHasFiveParts = postalAddressParts.length >= 5;
      const postalHasFourParts = postalAddressParts.length === 4;
      const nextUserDetails: UserDetailsForm = {
        user_name: data.user_name,
        user_surname: data.user_surname,
        user_email: data.user_email,
        user_contact: data.user_contact,
      };
      setUserDetails(nextUserDetails);
      setInitialUserDetails(nextUserDetails);
      const nextCompanyDetails: CompanyDetailsForm = {
        company_type: data.company_type ?? "",
        company_name: data.company_name,
        registration_number: data.registration_number,
        vat_number: data.vat_number || "",
        physical_address_line1: hasFourParts ? "" : addressParts[0] || "",
        physical_address_line2: hasFourParts ? addressParts[0] || "" : addressParts[1] || "",
        city: hasFourParts ? addressParts[1] || "" : addressParts[2] || "",
        province: hasFourParts ? addressParts[2] || "" : addressParts[3] || "",
        area_code: hasFourParts ? addressParts[3] || "" : addressParts[4] || "",
        postal_address_line1: postalAddressParts[0] || "",
        postal_address_line2: postalHasFiveParts ? postalAddressParts[1] || "" : "",
        postal_city: postalHasFiveParts ? postalAddressParts[2] || "" : postalHasFourParts ? postalAddressParts[1] || "" : "",
        postal_province: postalHasFiveParts ? postalAddressParts[3] || "" : postalHasFourParts ? postalAddressParts[2] || "" : "",
        postal_area_code: postalHasFiveParts ? postalAddressParts[4] || "" : postalHasFourParts ? postalAddressParts[3] || "" : "",
        representative_name: data.representative_name,
        representative_surname: data.representative_surname,
        company_contact: data.company_contact,
        company_email: data.company_email,
      };
      setCompanyDetails(nextCompanyDetails);
      setInitialCompanyDetails(nextCompanyDetails);
      const branchValues: BranchEntry[] = Array.isArray(data.branches)
        ? data.branches
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
      const nextBranchSettings: BranchSettingsForm = {
        branches_enabled: Boolean(data.branches_enabled),
        branches: branchValues,
      };
      setBranchSettings(nextBranchSettings);
      setInitialBranchSettings(nextBranchSettings);

      const storedLogoDataUrl = (((data as any).company_logo_data_url ?? "") as string).trim();
      const storedLogoLayoutRaw = (((data as any).company_logo_layout ?? "") as string).trim().toLowerCase();
      const storedLogoLayout =
        storedLogoLayoutRaw === "vertical" || storedLogoLayoutRaw === "horizontal"
          ? storedLogoLayoutRaw
          : null;
      setPersonaliseLogoPreview(storedLogoDataUrl);
      setInitialPersonaliseLogoPreview(storedLogoDataUrl);
      setPersonaliseLogoLayout(storedLogoLayout);
      setInitialPersonaliseLogoLayout(storedLogoLayout);
    }
    setLoading(false);
  };

  const handleAddBranch = () => {
    const normalizedName = branchForm.name.trim().replace(/\s+/g, " ");
    if (!normalizedName) return;
    const duplicateExists = branchSettings.branches.some(
      (value) => value.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (duplicateExists) {
      toast({
        title: "Branch already exists",
        description: "Please add a unique branch name.",
        variant: "destructive",
      });
      return;
    }
    setBranchSettings((prev) => ({
      ...prev,
      branches: [
        ...prev.branches,
        {
          name: normalizedName,
          address_line1: branchForm.address_line1.trim(),
          address_line2: branchForm.address_line2.trim(),
          city: branchForm.city.trim(),
          province: branchForm.province.trim(),
          area_code: branchForm.area_code.trim(),
        },
      ],
    }));
    setBranchForm(emptyBranchForm);
  };

  const handleRemoveBranch = (branchNameToRemove: string) => {
    const confirmed = confirm(
      `Are you sure you want to delete "${branchNameToRemove}"?`,
    );
    if (!confirmed) return;

    setBranchSettings((prev) => ({
      ...prev,
      branches: prev.branches.filter((value) => value.name !== branchNameToRemove),
    }));

    if (selectedBranchName === branchNameToRemove) {
      setSelectedBranchName(null);
      setBranchForm(emptyBranchForm);
    }
  };

  const handleCancelBranchAction = () => {
    setShowBranchForm(false);
    setBranchEditMode(false);
    setSelectedBranchName(null);
    setBranchForm(emptyBranchForm);
  };

  const handleBranchSettingsUpdate = async () => {
    if (!user) return;
    setBranchSaving(true);

    const normalizedFormName = branchForm.name.trim().replace(/\s+/g, " ");
    const selectedNameNormalized = selectedBranchName?.trim().toLowerCase() ?? "";
    let branchSource = [...branchSettings.branches];

    if (branchSettings.branches_enabled && showBranchForm && normalizedFormName) {
      const pendingDuplicate = branchSource.some(
        (item) => item.name.trim().toLowerCase() === normalizedFormName.toLowerCase(),
      );
      if (pendingDuplicate) {
        toast({
          title: "Branch already exists",
          description: "Please add a unique branch name.",
          variant: "destructive",
        });
        setBranchSaving(false);
        return;
      }
      branchSource.push({
        name: normalizedFormName,
        address_line1: branchForm.address_line1.trim(),
        address_line2: branchForm.address_line2.trim(),
        city: branchForm.city.trim(),
        province: branchForm.province.trim(),
        area_code: branchForm.area_code.trim(),
      });
    }

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

    const { error } = await supabase
      .from("profiles")
      .update({
        branches_enabled: branchSettings.branches_enabled,
        branches: cleanedBranches,
      } as any)
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } else {
      setBranchSettings((prev) => ({
        ...prev,
        branches: cleanedBranches,
      }));
      setInitialBranchSettings({
        branches_enabled: branchSettings.branches_enabled,
        branches: cleanedBranches,
      });
      if (showBranchForm) {
        setBranchForm(emptyBranchForm);
        setShowBranchForm(false);
      }
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
    }

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

      const validated = companySetupSchema.parse({
        companyType: companyDetails.company_type,
        companyName: companyDetails.company_name,
        registrationNumber: companyDetails.registration_number,
        physicalAddressLine1: companyDetails.physical_address_line1,
        physicalAddressLine2: companyDetails.physical_address_line2,
        city: companyDetails.city,
        province: companyDetails.province,
        areaCode: companyDetails.area_code,
        postalAddress: postalAddress,
        companyContact: companyDetails.company_contact,
        companyEmail: companyDetails.company_email,
        userName: companyDetails.representative_name,
        userSurname: companyDetails.representative_surname,
        userContact: companyDetails.company_contact,
        userEmail: companyDetails.company_email
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
          company_type: validated.companyType,
          company_name: validated.companyName,
          registration_number: validated.registrationNumber,
          vat_number: companyDetails.vat_number || null,
          physical_address: physicalAddress,
          postal_address: validated.postalAddress || "",
          representative_name: validated.userName,
          representative_surname: validated.userSurname,
          company_contact: validated.companyContact,
          company_email: validated.companyEmail
        })
        .eq("id", user.id);

      if (error) throw error;

      setInitialCompanyDetails(companyDetails);

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

  const handleCopyPhysicalToPostal = () => {
    setCompanyDetails((prev) => ({
      ...prev,
      postal_address_line1: prev.physical_address_line1,
      postal_address_line2: prev.physical_address_line2,
      postal_city: prev.city,
      postal_province: prev.province,
      postal_area_code: prev.area_code,
    }));
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
  const hasBranchFormValues = Object.values(branchForm).some((value) => value.trim().length > 0);

  const isUserDirty = JSON.stringify(userDetails) !== JSON.stringify(initialUserDetails);
  const isCompanyProfileDirty = companyProfileKeys.some(
    (key) => companyDetails[key] !== initialCompanyDetails[key],
  );
  const isCompanyAddressDirty = companyAddressKeys.some(
    (key) => companyDetails[key] !== initialCompanyDetails[key],
  );
  const isBranchSettingsDirty = JSON.stringify(branchSettings) !== JSON.stringify(initialBranchSettings);
  const isBranchAddDirty = showBranchForm && hasBranchFormValues;
  const isBranchEditDirty =
    branchEditMode &&
    Boolean(selectedBranch) &&
    JSON.stringify(branchForm) !== JSON.stringify(selectedBranch);
  const shouldShowCompanySetupPrimaryAction = isBranchSettingsDirty || isBranchAddDirty || isBranchEditDirty;
  const shouldShowAuthAction =
    passwordData.newPassword.trim().length > 0 || passwordData.confirmPassword.trim().length > 0;
  const isPersonaliseDirty =
    personaliseLogoPreview !== initialPersonaliseLogoPreview ||
    personaliseLogoLayout !== initialPersonaliseLogoLayout;

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    navigate("/dashboard");
  };

  const handleSubuserInviteDialogChange = (open: boolean) => {
    setIsInviteSubuserOpen(open);
    if (!open) {
      setSubuserInviteForm(emptySubuserInviteForm);
      setSubuserInviteSubmitting(false);
    }
  };

  const handleSubuserInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubuserInviteSubmitting(true);

    const payload = {
      name: subuserInviteForm.name.trim(),
      surname: subuserInviteForm.surname.trim(),
      contact_number: subuserInviteForm.contact_number.trim(),
      email: subuserInviteForm.email.trim().toLowerCase(),
    };

    const { data, error } = await supabase.functions.invoke("Subuser_invites", {
      body: payload,
    });
    const response = (data ?? null) as { ok?: boolean; error?: string } | null;

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
      title: "Invite sent",
      description: `Invitation link sent to ${payload.email}.`,
    });
    handleSubuserInviteDialogChange(false);
  };

  if (loading) {
    if (embedded) {
      return (
        <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
          <DialogContent className="h-[84vh] w-[94vw] max-w-[980px] gap-0 overflow-hidden rounded-sm border-0 bg-white p-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:rounded-sm [&>button]:hidden">
            <div className="flex h-full items-center justify-center">
              <img src="/zappir_thumbnail_blue.png" alt="Loading" className="h-12 w-12 animate-spin" style={{ animationDuration: "2s" }} />
            </div>
          </DialogContent>
        </Dialog>
      );
    }
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <img src="/zappir_thumbnail_blue.png" alt="Loading" className="h-12 w-12 animate-spin" style={{ animationDuration: "2s" }} />
        </div>
      </DashboardLayout>
    );
  }

  const content = (
      <div className={embedded ? "h-full w-full p-0" : "h-[calc(100dvh-var(--app-header-height,5rem)-2rem)] px-4 py-4"}>
        <div className={`mx-auto flex h-full w-full ${embedded ? "rounded-sm border-0 bg-white !shadow-none" : "max-w-[980px] rounded-sm border border-slate-300 bg-white shadow-sm"} flex-col overflow-hidden`}>
          <header className="flex items-center justify-between bg-[#2D4256] px-6 py-3 -mx-px -mt-px">
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
                      onClick={() => setSettingsTab(tab.value)}
                      className={`mx-1 my-0.5 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded px-4 py-3 text-left text-[10px] font-semibold transition-colors ${
                        isActive
                          ? "bg-blue-50 text-slate-900"
                          : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
                      }`}
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-[10px] font-semibold leading-4">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-w-0 flex-1 min-h-0 flex flex-col">
            <section className="relative min-h-0 flex-1 overflow-y-auto rounded-sm bg-white px-4 py-3 text-[11px] text-slate-700 [&_.text-muted-foreground]:!text-slate-500 [&_input]:h-[34px] [&_input]:w-full [&_input]:rounded [&_input]:border-[0.5px] [&_input]:border-slate-400 [&_input]:bg-white [&_input]:px-3 [&_input]:text-[11px] [&_input]:font-medium [&_input]:text-slate-900 [&_input]:shadow-none [&_input]:placeholder:text-[10px] [&_input]:placeholder:text-slate-400 [&_input:hover]:border-blue-400 [&_input]:focus-visible:border-slate-300 [&_input]:focus-visible:ring-0 [&_input]:focus-visible:ring-offset-0 [&_[role=combobox]]:h-[34px] [&_[role=combobox]]:w-full [&_[role=combobox]]:rounded [&_[role=combobox]]:border-[0.5px] [&_[role=combobox]]:border-slate-400 [&_[role=combobox]]:bg-white [&_[role=combobox]]:px-3 [&_[role=combobox]]:text-[11px] [&_[role=combobox]]:font-medium [&_[role=combobox]]:text-slate-900 [&_[role=combobox]]:shadow-none [&_[role=combobox]:hover]:border-blue-400 [&_[role=combobox]]:focus:border-blue-600 [&_[role=combobox]]:focus-visible:border-blue-600 [&_[role=combobox]]:focus-visible:ring-0 [&_[role=combobox]]:focus-visible:ring-offset-0 [&_[role=combobox]]:data-[state=open]:border-blue-600">
              {settingsTab === "user" && (
            <div className="flex h-full flex-col space-y-8">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">User Details</h3>
                <p className="mb-2 text-[11px] text-slate-500">Update your personal information</p>
              </div>
              <div className="flex flex-1 flex-col gap-7">
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
                <h3 className="text-sm font-semibold text-slate-900">Subusers</h3>
                <p className="mb-2 text-[11px] text-slate-500">
                  Here, the main user can add multiple users by sending a link to their email address.
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
            </div>
              )}

              {settingsTab === "company" && (
            <div className="flex h-full flex-col space-y-8">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Company Profile</h3>
                <p className="mb-2 text-[11px] text-slate-500">Update your company details</p>
              </div>
              <div className="flex flex-1 flex-col gap-7">
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Company Name</span>
                    <Input
                      id="company_name"
                      value={companyDetails.company_name}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, company_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Company Type</span>
                    <Select
                      value={companyDetails.company_type}
                      onValueChange={(value) =>
                        setCompanyDetails({
                          ...companyDetails,
                          company_type: value,
                        })
                      }
                    >
                      <SelectTrigger id="company_type" aria-label="Company Type">
                        <SelectValue placeholder="Choose company type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="(Pty) Ltd">Private Company (Pty) Ltd</SelectItem>
                        <SelectItem value="Ltd">Public Company Ltd</SelectItem>
                        <SelectItem value="Inc">Personal Liability Company Inc</SelectItem>
                        <SelectItem value="NPC">Non-Profit Company NPC</SelectItem>
                        <SelectItem value="SOC Ltd">State-Owned Company SOC Ltd</SelectItem>
                        <SelectItem value="CC">Close Corporation CC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Registration Number</span>
                    <Input
                      id="registration_number"
                      value={companyDetails.registration_number}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          registration_number: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>VAT Number</span>
                    <Input
                      id="vat_number"
                      value={companyDetails.vat_number}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, vat_number: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Company Contact</span>
                    <Input
                      id="company_contact"
                      value={companyDetails.company_contact}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          company_contact: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Company Email</span>
                    <Input
                      id="company_email"
                      type="email"
                      value={companyDetails.company_email}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          company_email: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Representative First Name</span>
                    <Input
                      id="representative_name"
                      value={companyDetails.representative_name}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          representative_name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Representative Last Name</span>
                    <Input
                      id="representative_surname"
                      value={companyDetails.representative_surname}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          representative_surname: e.target.value,
                        })
                      }
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
            <div className="flex h-full flex-col space-y-8">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Company Address</h3>
                <p className="mb-2 text-[11px] text-slate-500">Update physical and postal address details.</p>
              </div>
              <div className="flex flex-1 flex-col gap-7">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Physical</h4>
                  <div className="h-px w-full bg-blue-200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Address Line 1</span>
                    <Input
                      id="physical_address_line1"
                      value={companyDetails.physical_address_line1}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          physical_address_line1: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Address Line 2</span>
                    <Input
                      id="physical_address_line2"
                      value={companyDetails.physical_address_line2}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          physical_address_line2: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>City</span>
                    <Input
                      id="city"
                      value={companyDetails.city}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          city: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Province</span>
                    <Select
                      value={companyDetails.province}
                      onValueChange={(value) =>
                        setCompanyDetails({
                          ...companyDetails,
                          province: value,
                        })
                      }
                    >
                      <SelectTrigger
                        id="province"
                        aria-label="Province"
                        className="bg-white border-slate-300 text-slate-900 hover:border-blue-400 focus:border-slate-300 focus-visible:border-slate-300 !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none data-[state=open]:border-slate-300 data-[state=open]:bg-white data-[placeholder]:!text-[10px] data-[placeholder]:!font-medium data-[placeholder]:!text-slate-400"
                      >
                        <SelectValue placeholder="Choose province" />
                      </SelectTrigger>
                      <SelectContent>
                        {southAfricanProvinces.map((province) => (
                          <SelectItem key={province} value={province}>
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Area Code</span>
                    <Input
                      id="area_code"
                      value={companyDetails.area_code}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          area_code: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1 pt-3">
                  <div className="flex items-center gap-6">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Postal</h4>
                    <Button
                      type="button"
                      onClick={handleCopyPhysicalToPostal}
                      className="h-6 rounded border border-slate-400 bg-white px-2 text-[10px] font-medium text-slate-500 hover:border-blue-600 hover:bg-white hover:text-blue-600"
                    >
                      Copy from Physical
                    </Button>
                  </div>
                  <div className="h-px w-full bg-blue-200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Address Line 1</span>
                    <Input
                      id="postal_address_line1"
                      value={companyDetails.postal_address_line1}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          postal_address_line1: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Address Line 2</span>
                    <Input
                      id="postal_address_line2"
                      value={companyDetails.postal_address_line2}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          postal_address_line2: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>City</span>
                    <Input
                      id="postal_city"
                      value={companyDetails.postal_city}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          postal_city: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Province</span>
                    <Select
                      value={companyDetails.postal_province}
                      onValueChange={(value) =>
                        setCompanyDetails({
                          ...companyDetails,
                          postal_province: value,
                        })
                      }
                    >
                      <SelectTrigger
                        id="postal_province"
                        aria-label="Postal Province"
                        className="bg-white border-slate-300 text-slate-900 hover:border-blue-400 focus:border-slate-300 focus-visible:border-slate-300 !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none data-[state=open]:border-slate-300 data-[state=open]:bg-white data-[placeholder]:!text-[10px] data-[placeholder]:!font-medium data-[placeholder]:!text-slate-400"
                      >
                        <SelectValue placeholder="Choose province" />
                      </SelectTrigger>
                      <SelectContent>
                        {southAfricanProvinces.map((province) => (
                          <SelectItem key={province} value={province}>
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative w-full max-w-none">
                    <span className={floatingLabelClass}>Postal Code</span>
                    <Input
                      id="postal_area_code"
                      value={companyDetails.postal_area_code}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          postal_area_code: e.target.value,
                        })
                      }
                    />
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
            <div className="flex h-full flex-col space-y-8">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Authentication</h3>
                <p className="mb-2 text-[11px] text-slate-500">Change your password here whenever you need to keep your account secure.</p>
              </div>
              <div className="flex flex-1 flex-col gap-7">
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
                <div className="flex h-full flex-col space-y-8">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900">Company Setup</h3>
                    <p className="mb-2 text-[11px] text-slate-500">Enable branch management to organize employees by location and assign them to the correct operating unit across your business.</p>
                  </div>
                  <div className="flex flex-1 flex-col gap-7">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="branches_enabled"
                          className="-mt-0.5 scale-90 data-[state=checked]:!bg-blue-600 data-[state=unchecked]:!bg-slate-300"
                          checked={branchSettings.branches_enabled}
                          onCheckedChange={(checked) => {
                            setBranchSettings((prev) => ({
                              ...prev,
                              branches_enabled: checked,
                            }));
                            if (!checked) {
                              setShowBranchForm(false);
                              setBranchEditMode(false);
                              setSelectedBranchName(null);
                              setBranchForm(emptyBranchForm);
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
                                    className="!h-7 !border !border-slate-300 px-2 pr-7 text-[10px] placeholder:text-[10px] hover:border-blue-400"
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
                                      setBranchEditMode((prev) => {
                                        const next = !prev;
                                        if (next) {
                                          setShowBranchForm(false);
                                          setSelectedBranchName(null);
                                          setBranchForm(emptyBranchForm);
                                        }
                                        return next;
                                      });
                                    }}
                                    className="h-7 w-[64px] rounded px-2 text-[10px] inline-flex items-center justify-center border-[0.5px] border-slate-300 bg-white text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-600"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setBranchEditMode(false);
                                      setSelectedBranchName(null);
                                      setShowBranchForm((prev) => {
                                        const next = !prev;
                                        if (next) setBranchForm(emptyBranchForm);
                                        return next;
                                      });
                                    }}
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
                                    setShowBranchForm((prev) => {
                                      const next = !prev;
                                      if (next) setBranchForm(emptyBranchForm);
                                      return next;
                                    });
                                  }}
                                  className={`h-7 w-[92px] rounded px-2 text-[10px] inline-flex items-center justify-center border-[0.5px] border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white ${
                                    showBranchForm ? "bg-blue-600 text-white hover:bg-blue-700" : ""
                                  }`}
                                >
                                  New Branch
                                </Button>
                              </div>
                            )}

                            {branchSettings.branches.length > 0 ? (
                              <div
                                className={`relative rounded border bg-white px-3 pb-2 pt-3 ${
                                  branchEditMode ? "border-blue-600" : "border-slate-300"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold leading-none ${
                                    branchEditMode ? "text-slate-900" : "text-slate-500"
                                  }`}
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
                                        key={branchEntry.name}
                                        variant="outline"
                                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] leading-none !font-normal ${
                                          branchEditMode
                                            ? selectedBranchName === branchEntry.name
                                              ? "cursor-pointer border-blue-600 bg-blue-600 text-white"
                                              : "cursor-pointer border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                            : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-50"
                                        }`}
                                        onClick={
                                          branchEditMode
                                            ? () => {
                                                setSelectedBranchName(branchEntry.name);
                                                setBranchForm({
                                                  name: branchEntry.name,
                                                  address_line1: branchEntry.address_line1,
                                                  address_line2: branchEntry.address_line2,
                                                  city: branchEntry.city,
                                                  province: branchEntry.province,
                                                  area_code: branchEntry.area_code,
                                                });
                                              }
                                            : undefined
                                        }
                                      >
                                        <span>{branchEntry.name}</span>
                                        {!branchEditMode ? (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveBranch(branchEntry.name)}
                                            className="ml-1 inline-flex items-center text-blue-600 hover:text-blue-800"
                                            aria-label={`Remove ${branchEntry.name}`}
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        ) : null}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          {showBranchForm || (branchEditMode && selectedBranchName) ? (
                            <>
                              <div className="relative w-full max-w-none">
                                <span className={floatingLabelClass}>Branch Name</span>
                                <Input
                                  placeholder="Enter branch name"
                                  value={branchForm.name}
                                  onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      handleAddBranch();
                                    }
                                  }}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="relative w-full max-w-none">
                                  <span className={floatingLabelClass}>Address Line 1</span>
                                  <Input
                                    placeholder="Enter address line 1"
                                    value={branchForm.address_line1}
                                    onChange={(e) => setBranchForm((prev) => ({ ...prev, address_line1: e.target.value }))}
                                  />
                                </div>
                                <div className="relative w-full max-w-none">
                                  <span className={floatingLabelClass}>Address Line 2</span>
                                  <Input
                                    placeholder="Enter address line 2"
                                    value={branchForm.address_line2}
                                    onChange={(e) => setBranchForm((prev) => ({ ...prev, address_line2: e.target.value }))}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <div className="relative w-full max-w-none">
                                  <span className={floatingLabelClass}>City</span>
                                  <Input
                                    placeholder="Enter city"
                                    value={branchForm.city}
                                    onChange={(e) => setBranchForm((prev) => ({ ...prev, city: e.target.value }))}
                                  />
                                </div>
                                <div className="relative w-full max-w-none">
                                  <span className={floatingLabelClass}>Province</span>
                                  <Select
                                    value={branchForm.province}
                                    onValueChange={(value) => setBranchForm((prev) => ({ ...prev, province: value }))}
                                  >
                                    <SelectTrigger
                                      aria-label="Branch province"
                                      className="bg-white border-slate-300 text-slate-900 hover:border-blue-400 focus:border-slate-300 focus-visible:border-slate-300 !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none data-[state=open]:border-slate-300 data-[state=open]:bg-white data-[placeholder]:!text-[10px] data-[placeholder]:!font-medium data-[placeholder]:!text-slate-400"
                                    >
                                      <SelectValue placeholder="Choose province" />
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
                                <div className="relative w-full max-w-none">
                                  <span className={floatingLabelClass}>Area Code</span>
                                  <Input
                                    placeholder="Enter area code"
                                    value={branchForm.area_code}
                                    onChange={(e) => setBranchForm((prev) => ({ ...prev, area_code: e.target.value }))}
                                  />
                                </div>
                              </div>

                            </>
                          ) : null}

                          {showBranchForm || branchEditMode || shouldShowCompanySetupPrimaryAction ? (
                            <div className={`${settingsActionRowClass} gap-2`}>
                              {showBranchForm || branchEditMode ? (
                                <Button
                                  type="button"
                                  onClick={handleCancelBranchAction}
                                  disabled={branchSaving}
                                  variant="outline"
                                  className="h-8 min-w-[108px] rounded border-slate-300 px-3 text-[11px] text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Cancel
                                </Button>
                              ) : null}
                              {shouldShowCompanySetupPrimaryAction ? (
                                <Button
                                  type="button"
                                  onClick={handleBranchSettingsUpdate}
                                  disabled={branchSaving}
                                  className={
                                    showBranchForm
                                      ? "h-[28px] min-w-[108px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600"
                                      : popupActionButtonClass
                                  }
                                >
                                  {branchSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  {showBranchForm ? "Add Branch" : "Save Changes"}
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
              )}

              {settingsTab === "plan" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Subscription Plan</h3>
                <p className="mb-2 text-[11px] text-slate-500">Manage your subscription</p>
              </div>
              <div>
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    Subscription plans are coming soon!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You currently have access to all features. We'll notify you when subscription
                    options become available.
                  </p>
                </div>
              </div>
            </div>
              )}

              {settingsTab === "personalize" && (
                <div className="flex h-full flex-col space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900">Personalise</h3>
                    <p className="mb-2 text-[11px] text-slate-500">Fine-tune how your documents look so every output feels more aligned with your brand and communication style.</p>
                  </div>

                  <div className="space-y-1 pt-3">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-900">Company Logo</h4>
                    <div className="h-px w-full bg-blue-200" />
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
            </section>

            <Dialog open={isInviteSubuserOpen} onOpenChange={handleSubuserInviteDialogChange}>
              <DialogContent
                className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
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
                <div className="px-6 pt-0 pb-7"></div>
                <form onSubmit={handleSubuserInviteSubmit} className="space-y-4 px-6 pb-6 pt-0">
                  <div className="w-full space-y-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Name <span className="text-red-600">*</span></span>
                        <Input
                          value={subuserInviteForm.name}
                          onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, name: e.target.value }))}
                          className={subuserModalInputClass}
                          placeholder="Please insert name"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Surname <span className="text-red-600">*</span></span>
                        <Input
                          value={subuserInviteForm.surname}
                          onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, surname: e.target.value }))}
                          className={subuserModalInputClass}
                          placeholder="Please insert surname"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Contact Number <span className="text-red-600">*</span></span>
                        <Input
                          value={subuserInviteForm.contact_number}
                          onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, contact_number: e.target.value }))}
                          className={subuserModalInputClass}
                          placeholder="Please insert contact number"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <div className="relative w-full max-w-none">
                        <span className={floatingLabelClass}>Email <span className="text-red-600">*</span></span>
                        <Input
                          type="email"
                          value={subuserInviteForm.email}
                          onChange={(e) => setSubuserInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                          className={subuserModalInputClass}
                          placeholder="Please insert email"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-[28px] w-[84px] rounded border-slate-300 px-3 text-xs text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-600"
                      onClick={() => handleSubuserInviteDialogChange(false)}
                      disabled={subuserInviteSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="h-[28px] w-[84px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-white"
                      disabled={subuserInviteSubmitting || !isSubuserInviteFormComplete}
                    >
                      {subuserInviteSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit
                    </Button>
                  </div>
                </form>
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
        <DialogContent className="h-[84vh] w-[94vw] max-w-[980px] gap-0 overflow-hidden rounded-sm border-0 bg-white p-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:rounded-sm [&>button]:hidden">
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return <DashboardLayout>{content}</DashboardLayout>;
};

export default Settings;




