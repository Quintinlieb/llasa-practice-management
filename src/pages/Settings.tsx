import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Plus, X, Menu, User, Building2, Lock, FileText, Palette, SlidersHorizontal } from "lucide-react";
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

const Settings = ({ embedded = false, onClose }: SettingsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [userDetails, setUserDetails] = useState({
    user_name: "",
    user_surname: "",
    user_email: "",
    user_contact: "",
  });

  const [companyDetails, setCompanyDetails] = useState({
    company_type: "",
    company_name: "",
    registration_number: "",
    vat_number: "",
    physical_address_line1: "",
    physical_address_line2: "",
    city: "",
    province: "",
    area_code: "",
    postal_address: "",
    representative_name: "",
    representative_surname: "",
    company_contact: "",
    company_email: "",
  });
  const [branchSettings, setBranchSettings] = useState({
    branches_enabled: false,
    branches: [] as string[],
  });
  const [branchNameInput, setBranchNameInput] = useState("");
  const [branchSaving, setBranchSaving] = useState(false);

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordError, setPasswordError] = useState("");
  const [settingsTab, setSettingsTab] = useState<"user" | "company" | "companySetup" | "auth" | "plan" | "personalize">("user");

  const settingsTabs: Array<{ value: "user" | "company" | "companySetup" | "auth" | "plan" | "personalize"; label: string; icon: LucideIcon }> = [
    { value: "user", label: "User Details", icon: User },
    { value: "company", label: "Company Details", icon: Building2 },
    { value: "companySetup", label: "Company Setup", icon: SlidersHorizontal },
    { value: "auth", label: "Authentication", icon: Lock },
    { value: "plan", label: "Plan", icon: FileText },
    { value: "personalize", label: "Personalize", icon: Palette },
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await (supabase as any)
      .from("profiles")
      .select(
        "user_name, user_surname, user_email, user_contact, company_type, company_name, registration_number, vat_number, physical_address, postal_address, representative_name, representative_surname, company_contact, company_email, branches_enabled, branches",
      )
      .eq("id", user.id)
      .maybeSingle();

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
      const hasFourParts = addressParts.length === 4;
      setUserDetails({
        user_name: data.user_name,
        user_surname: data.user_surname,
        user_email: data.user_email,
        user_contact: data.user_contact,
      });
      setCompanyDetails({
        company_type: data.company_type ?? "",
        company_name: data.company_name,
        registration_number: data.registration_number,
        vat_number: data.vat_number || "",
        physical_address_line1: hasFourParts ? "" : addressParts[0] || "",
        physical_address_line2: hasFourParts ? addressParts[0] || "" : addressParts[1] || "",
        city: hasFourParts ? addressParts[1] || "" : addressParts[2] || "",
        province: hasFourParts ? addressParts[2] || "" : addressParts[3] || "",
        area_code: hasFourParts ? addressParts[3] || "" : addressParts[4] || "",
        postal_address: data.postal_address,
        representative_name: data.representative_name,
        representative_surname: data.representative_surname,
        company_contact: data.company_contact,
        company_email: data.company_email,
      });
      const branchValues = Array.isArray(data.branches)
        ? data.branches
            .map((value: unknown) => String(value ?? "").trim())
            .filter(Boolean)
        : [];
      setBranchSettings({
        branches_enabled: Boolean(data.branches_enabled),
        branches: branchValues,
      });
    }
    setLoading(false);
  };

  const handleAddBranch = () => {
    const normalized = branchNameInput.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const duplicateExists = branchSettings.branches.some(
      (value) => value.toLowerCase() === normalized.toLowerCase(),
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
      branches: [...prev.branches, normalized],
    }));
    setBranchNameInput("");
  };

  const handleRemoveBranch = (branchToRemove: string) => {
    setBranchSettings((prev) => ({
      ...prev,
      branches: prev.branches.filter((value) => value !== branchToRemove),
    }));
  };

  const handleBranchSettingsUpdate = async () => {
    if (!user) return;
    setBranchSaving(true);

    const cleanedBranches = Array.from(
      new Set(
        branchSettings.branches
          .map((value) => value.trim().replace(/\s+/g, " "))
          .filter(Boolean),
      ),
    );

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
      const validated = companySetupSchema.parse({
        companyType: companyDetails.company_type,
        companyName: companyDetails.company_name,
        registrationNumber: companyDetails.registration_number,
        physicalAddressLine1: companyDetails.physical_address_line1,
        physicalAddressLine2: companyDetails.physical_address_line2,
        city: companyDetails.city,
        province: companyDetails.province,
        areaCode: companyDetails.area_code,
        postalAddress: companyDetails.postal_address,
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

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    navigate("/dashboard");
  };

  if (loading) {
    if (embedded) {
      return (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/65"
            aria-label="Close settings"
            onClick={handleClose}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <section className="relative z-10 h-[70vh] w-full max-w-[980px] overflow-hidden rounded-sm border-0 bg-[#2D4256] !shadow-none">
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </section>
          </div>
        </div>
      );
    }
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const selectedTabLabel = settingsTabs.find((tab) => tab.value === settingsTab)?.label ?? "User Details";
  const companyDisplayName = companyDetails.company_name?.trim() || "Company";

  const content = (
      <div className={embedded ? "h-full w-full p-0" : "h-[calc(100dvh-var(--app-header-height,5rem)-2rem)] px-4 py-4"}>
        <div className={`mx-auto flex h-full w-full ${embedded ? "max-w-[980px] rounded-sm border-0 bg-[#2D4256] !shadow-none" : "max-w-[980px] rounded-sm border border-slate-300 bg-[#2D4256] shadow-sm"} flex-col overflow-hidden`}>
          <header className="flex items-center justify-between px-6 pt-4 pb-3">
            <div className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-[10px] text-slate-500">
              <Menu className="h-3.5 w-3.5 -ml-1" />
              <span className="font-semibold text-slate-700">{`${companyDisplayName} / Settings / ${selectedTabLabel}`}</span>
            </div>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-sm bg-sky-50 text-slate-500 hover:text-slate-900"
              onClick={handleClose}
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 px-6 pb-4">
            <div className="flex h-full min-h-0 items-stretch gap-4">
            <aside className="h-full w-[180px] overflow-hidden rounded-sm bg-[#2D4256]">
              <div className="px-4 py-3 text-[10px] font-semibold text-white/70">Settings</div>
              <div className="space-y-0">
                {settingsTabs.map((tab) => {
                  const isActive = settingsTab === tab.value;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setSettingsTab(tab.value)}
                      className={`flex w-full items-center gap-3 border-b border-white/10 px-5 py-3 text-left text-[10px] font-semibold text-white transition-all duration-150 hover:bg-[#010D1A] hover:text-white ${
                        isActive ? "bg-[#010D1A] border-b-2 border-b-blue-500" : ""
                      }`}
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                        <Icon className="h-4 w-4 text-white" />
                      </span>
                      <span className="text-[10px] font-semibold leading-4 text-white">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-w-0 flex-1 min-h-0 flex flex-col">
            <section className="relative min-h-0 flex-1 overflow-y-auto rounded-sm border border-white/20 bg-[#2D4256] px-3 pt-2 pb-2 text-[11px] text-white [&_.text-muted-foreground]:!text-white/75 [&_label]:!text-[10px] [&_label]:!text-white/80 [&_input]:h-8 [&_input]:border-white/30 [&_input]:bg-[#2D4256] [&_input]:text-[11px] [&_input]:text-white [&_input]:placeholder:text-white/55 [&_button]:text-[11px] [&_[role=combobox]]:h-8 [&_[role=combobox]]:border-white/30 [&_[role=combobox]]:bg-[#2D4256] [&_[role=combobox]]:text-[11px] [&_[role=combobox]]:text-white">
              {settingsTab === "user" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">User Information</h3>
                <p className="text-[11px] text-white/75">Update your personal information</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user_name">First Name</Label>
                    <Input
                      id="user_name"
                      value={userDetails.user_name}
                      onChange={(e) =>
                        setUserDetails({ ...userDetails, user_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user_surname">Last Name</Label>
                    <Input
                      id="user_surname"
                      value={userDetails.user_surname}
                      onChange={(e) =>
                        setUserDetails({ ...userDetails, user_surname: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user_email">Email</Label>
                  <Input
                    id="user_email"
                    type="email"
                    value={userDetails.user_email}
                    onChange={(e) =>
                      setUserDetails({ ...userDetails, user_email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user_contact">Contact Number</Label>
                  <Input
                    id="user_contact"
                    value={userDetails.user_contact}
                    onChange={(e) =>
                      setUserDetails({ ...userDetails, user_contact: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleUserDetailsUpdate} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
              )}

              {settingsTab === "company" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Company Information</h3>
                <p className="text-[11px] text-white/75">Update your company details</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_type" className="text-blue-600">Company Type</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-blue-600">Company Name</Label>
                  <Input
                    id="company_name"
                    value={companyDetails.company_name}
                    onChange={(e) =>
                      setCompanyDetails({ ...companyDetails, company_name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registration_number" className="text-blue-600">Registration Number</Label>
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
                  <div className="space-y-2">
                    <Label htmlFor="vat_number" className="text-blue-600">VAT Number</Label>
                    <Input
                      id="vat_number"
                      value={companyDetails.vat_number}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, vat_number: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-blue-600">Physical Address</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="physical_address_line1" className="text-gray-600">Street Address</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="physical_address_line2" className="text-gray-600">Address Line 2</Label>
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
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-gray-600">City</Label>
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
                  <div className="space-y-2">
                    <Label htmlFor="province" className="text-gray-600">Province</Label>
                    <Select
                      value={companyDetails.province}
                      onValueChange={(value) =>
                        setCompanyDetails({
                          ...companyDetails,
                          province: value,
                        })
                      }
                    >
                      <SelectTrigger id="province" aria-label="Province">
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
                  <div className="space-y-2">
                    <Label htmlFor="area_code" className="text-gray-600">Area Code</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="postal_address" className="text-blue-600">Postal Address</Label>
                  <Input
                    id="postal_address"
                    value={companyDetails.postal_address}
                    onChange={(e) =>
                      setCompanyDetails({
                        ...companyDetails,
                        postal_address: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="representative_name" className="text-blue-600">Representative First Name</Label>
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
                  <div className="space-y-2">
                    <Label htmlFor="representative_surname" className="text-blue-600">Representative Last Name</Label>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_contact" className="text-blue-600">Company Contact</Label>
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
                  <div className="space-y-2">
                    <Label htmlFor="company_email" className="text-blue-600">Company Email</Label>
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
                <Button onClick={handleCompanyDetailsUpdate} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
              )}

              {settingsTab === "auth" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Change Password</h3>
                <p className="text-[11px] text-white/75">Update your account password</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
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
                <Button onClick={handlePasswordReset} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </div>
            </div>
              )}

              {settingsTab === "companySetup" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">Company Setup</h3>
                    <p className="text-[11px] text-white/75">Configure company setup options for your workspace.</p>
                  </div>
                  <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-white">Branches</h3>
                          <p className="text-xs text-white/75">
                            Activate branches and configure the list available for your company.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="branches_enabled" className="text-sm !text-white/80">
                            Activate Branches
                          </Label>
                          <Switch
                            id="branches_enabled"
                            checked={branchSettings.branches_enabled}
                            onCheckedChange={(checked) =>
                              setBranchSettings((prev) => ({
                                ...prev,
                                branches_enabled: checked,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Enter branch name"
                          value={branchNameInput}
                          onChange={(e) => setBranchNameInput(e.target.value)}
                          disabled={!branchSettings.branches_enabled}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleAddBranch();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddBranch}
                          disabled={!branchSettings.branches_enabled || !branchNameInput.trim()}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {branchSettings.branches.length === 0 ? (
                          <p className="text-xs text-white/70">No branches added yet.</p>
                        ) : (
                          branchSettings.branches.map((branchName) => (
                            <div
                              key={branchName}
                              className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-white"
                            >
                              <span>{branchName}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveBranch(branchName)}
                                className="text-white/75 hover:text-rose-300"
                                aria-label={`Remove ${branchName}`}
                                disabled={!branchSettings.branches_enabled}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBranchSettingsUpdate}
                        disabled={branchSaving}
                      >
                        {branchSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Branch Settings
                      </Button>
                    </div>
                  </div>
              )}

              {settingsTab === "plan" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Subscription Plan</h3>
                <p className="text-[11px] text-white/75">Manage your subscription</p>
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
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">Personalize</h3>
                    <p className="text-[11px] text-white/75">Customize your workspace preferences</p>
                  </div>
                  <div>
                    <div className="text-center py-12">
                      <p className="text-muted-foreground mb-3">
                        Personalization settings are coming soon.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This section will allow you to tailor your Nudoc workspace and user experience.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
            </div>
          </div>
        </div>
        </div>
      </div>
  );

  if (embedded) {
    return (
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/65"
          aria-label="Close settings"
          onClick={handleClose}
        />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <section className="relative z-10 h-[70vh] w-full max-w-[980px] overflow-hidden rounded-sm">
            {content}
          </section>
        </div>
      </div>
    );
  }

  return <DashboardLayout>{content}</DashboardLayout>;
};

export default Settings;
