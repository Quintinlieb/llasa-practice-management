import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { z } from "zod";
import { companySetupSchema } from "@/lib/validation";
import { getSafeErrorMessage } from "@/lib/errorHandling";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character");

const Settings = () => {
  const { user } = useAuth();
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
    company_name: "",
    registration_number: "",
    vat_number: "",
    physical_address: "",
    postal_address: "",
    representative_name: "",
    representative_surname: "",
    company_contact: "",
    company_email: "",
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } else if (data) {
      setUserDetails({
        user_name: data.user_name,
        user_surname: data.user_surname,
        user_email: data.user_email,
        user_contact: data.user_contact,
      });
      setCompanyDetails({
        company_name: data.company_name,
        registration_number: data.registration_number,
        vat_number: data.vat_number || "",
        physical_address: data.physical_address,
        postal_address: data.postal_address,
        representative_name: data.representative_name,
        representative_surname: data.representative_surname,
        company_contact: data.company_contact,
        company_email: data.company_email,
      });
    }
    setLoading(false);
  };

  const handleUserDetailsUpdate = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Validate user fields using existing schema
      const validated = companySetupSchema.pick({
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
      // Split physical address back into components for validation
      const addressParts = companyDetails.physical_address.split(", ");
      
      // Validate company fields using existing schema
      const validated = companySetupSchema.parse({
        companyName: companyDetails.company_name,
        registrationNumber: companyDetails.registration_number,
        physicalAddressLine1: addressParts[0] || "",
        physicalAddressLine2: addressParts[1] || "",
        city: addressParts[2] || "",
        province: addressParts[3] || "Gauteng",
        areaCode: addressParts[4] || "0000",
        postalAddress: companyDetails.postal_address,
        companyContact: companyDetails.company_contact,
        companyEmail: companyDetails.company_email,
        userName: companyDetails.representative_name,
        userSurname: companyDetails.representative_surname,
        userContact: companyDetails.company_contact,
        userEmail: companyDetails.company_email
      });

      // Reconstruct physical address
      const physicalAddress = [
        validated.physicalAddressLine1,
        validated.physicalAddressLine2,
        validated.city,
        validated.province,
        validated.areaCode
      ].filter(Boolean).join(", ");
      
      // Update with validated data
      const { error } = await supabase
        .from("profiles")
        .update({
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and company settings</p>
        </div>

        <Tabs defaultValue="user" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="user">User Details</TabsTrigger>
            <TabsTrigger value="company">Company Details</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
          </TabsList>

          <TabsContent value="user">
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Update your company details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
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
                    <Label htmlFor="registration_number">Registration Number</Label>
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
                    <Label htmlFor="vat_number">VAT Number</Label>
                    <Input
                      id="vat_number"
                      value={companyDetails.vat_number}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, vat_number: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="physical_address">Physical Address</Label>
                  <Input
                    id="physical_address"
                    value={companyDetails.physical_address}
                    onChange={(e) =>
                      setCompanyDetails({
                        ...companyDetails,
                        physical_address: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_address">Postal Address</Label>
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
                    <Label htmlFor="representative_name">Representative First Name</Label>
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
                    <Label htmlFor="representative_surname">Representative Last Name</Label>
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
                    <Label htmlFor="company_contact">Company Contact</Label>
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
                    <Label htmlFor="company_email">Company Email</Label>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plan">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Plan</CardTitle>
                <CardDescription>Manage your subscription</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    Subscription plans are coming soon!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You currently have access to all features. We'll notify you when subscription
                    options become available.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
