import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { companySetupSchema } from "@/lib/validation";

const CompanySetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    registrationNumber: "",
    vatNumber: "",
    physicalAddress: "",
    postalAddress: "",
    representativeName: "",
    representativeSurname: "",
    companyContact: "",
    companyEmail: "",
    userName: "",
    userSurname: "",
    userContact: "",
    userEmail: "",
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      // Validate and sanitize input
      const validatedData = companySetupSchema.parse(formData);

      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        company_name: validatedData.companyName,
        registration_number: validatedData.registrationNumber,
        vat_number: validatedData.vatNumber,
        physical_address: validatedData.physicalAddress,
        postal_address: validatedData.postalAddress,
        representative_name: validatedData.representativeName,
        representative_surname: validatedData.representativeSurname,
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
                    <Label htmlFor="vatNumber">VAT Number</Label>
                    <Input
                      id="vatNumber"
                      name="vatNumber"
                      value={formData.vatNumber}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyContact">Company Contact *</Label>
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
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="physicalAddress">Physical Address *</Label>
                    <Input
                      id="physicalAddress"
                      name="physicalAddress"
                      value={formData.physicalAddress}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="postalAddress">Postal Address *</Label>
                    <Input
                      id="postalAddress"
                      name="postalAddress"
                      value={formData.postalAddress}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Representative Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Representative Details</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="representativeName">Name *</Label>
                    <Input
                      id="representativeName"
                      name="representativeName"
                      value={formData.representativeName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="representativeSurname">Surname *</Label>
                    <Input
                      id="representativeSurname"
                      name="representativeSurname"
                      value={formData.representativeSurname}
                      onChange={handleChange}
                      required
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