import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { companySetupSchema, southAfricanProvinces } from "@/lib/validation";

const CompanySetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    registrationNumber: "",
    physicalAddressLine1: "",
    physicalAddressLine2: "",
    city: "",
    province: "",
    areaCode: "",
    postalAddress: "",
    companyContact: "",
    companyEmail: "",
    userName: "",
    userSurname: "",
    userContact: "",
    userEmail: "",
  });

  // Route protection is handled by ProtectedRoute. Avoid redirecting here to prevent loops.

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleProvinceChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      province: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      // Validate and sanitize input
      const validatedData = companySetupSchema.parse(formData);

      const physicalAddressParts = [
        validatedData.physicalAddressLine1,
        validatedData.physicalAddressLine2,
        validatedData.city,
        validatedData.province,
        validatedData.areaCode,
      ].filter(Boolean);

      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        company_name: validatedData.companyName,
        registration_number: validatedData.registrationNumber,
        physical_address: physicalAddressParts.join(", "),
        postal_address: validatedData.postalAddress || "",
        representative_name: validatedData.userName,
        representative_surname: validatedData.userSurname,
        company_contact: validatedData.companyContact,
        company_email: validatedData.companyEmail,
        user_name: validatedData.userName,
        user_surname: validatedData.userSurname,
        user_contact: validatedData.userContact,
        user_email: validatedData.userEmail,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company profile created successfully!",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.errors?.[0]?.message || error.message || "Validation failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Company Setup</CardTitle>
            <CardDescription>
              Please complete your company profile to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Company Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">Registration Number *</Label>
                    <Input
                      id="registrationNumber"
                      name="registrationNumber"
                      value={formData.registrationNumber}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyContact">Contact Number *</Label>
                    <Input
                      id="companyContact"
                      name="companyContact"
                      value={formData.companyContact}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="companyEmail">Company Email *</Label>
                    <Input
                      id="companyEmail"
                      name="companyEmail"
                      type="email"
                      value={formData.companyEmail}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="physicalAddressLine1">Physical Address Line 1</Label>
                    <Input
                      id="physicalAddressLine1"
                      name="physicalAddressLine1"
                      placeholder="Apartment/suite number and complex name"
                      value={formData.physicalAddressLine1}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="physicalAddressLine2">Physical Address Line 2 *</Label>
                    <Input
                      id="physicalAddressLine2"
                      name="physicalAddressLine2"
                      placeholder="Street name and number"
                      value={formData.physicalAddressLine2}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="province">Province *</Label>
                    <Select value={formData.province} onValueChange={handleProvinceChange}>
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
                    <Label htmlFor="areaCode">Area Code *</Label>
                    <Input
                      id="areaCode"
                      name="areaCode"
                      value={formData.areaCode}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="postalAddress">Postal Address</Label>
                    <Input
                      id="postalAddress"
                      name="postalAddress"
                      value={formData.postalAddress}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Primary User Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Your Details</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="userName">Name *</Label>
                    <Input
                      id="userName"
                      name="userName"
                      value={formData.userName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userSurname">Surname *</Label>
                    <Input
                      id="userSurname"
                      name="userSurname"
                      value={formData.userSurname}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userContact">Contact Number *</Label>
                    <Input
                      id="userContact"
                      name="userContact"
                      value={formData.userContact}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userEmail">Email *</Label>
                    <Input
                      id="userEmail"
                      name="userEmail"
                      type="email"
                      value={formData.userEmail}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating Profile..." : "Complete Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanySetup;
