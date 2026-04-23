import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/errorHandling";

const nameRegex = /^[a-zA-Z\s'-]+$/;
const saPhoneRegex = /^(\+27|0)[1-9]\d{8}$/;

const personalSetupSchema = z.object({
  firstName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .regex(nameRegex, "Name can only contain letters, spaces, hyphens, and apostrophes"),
  surname: z
    .string()
    .min(2, "Surname must be at least 2 characters")
    .max(100, "Surname must not exceed 100 characters")
    .regex(nameRegex, "Surname can only contain letters, spaces, hyphens, and apostrophes"),
  idNumber: z
    .string()
    .min(5, "ID number is required")
    .max(30, "ID number must not exceed 30 characters"),
  contact: z
    .string()
    .regex(saPhoneRegex, "Invalid phone number (e.g., 0123456789 or +27123456789)"),
});

const CompanySetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    surname: "",
    idNumber: "",
    contact: "",
  });
  const [formError, setFormError] = useState("");

  const isFormValid = useMemo(
    () => personalSetupSchema.safeParse(formData).success,
    [formData],
  );

  const inputClass =
    "text-sm placeholder:text-xs border-slate-300 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-[#3eca44]/20";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormError("");
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setFormError("");

    try {
      const validatedData = personalSetupSchema.parse(formData);
      const normalizedEmail = (user.email ?? "").trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error("Authenticated user email is missing.");
      }
      const accountType = user.user_metadata?.account_type === "business" || user.user_metadata?.account_type === "trial"
        ? user.user_metadata.account_type
        : "domestic";
      const fullName = `${validatedData.firstName.trim()} ${validatedData.surname.trim()}`.trim();

      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          account_type: accountType,
          company_name: fullName,
          registration_number: validatedData.idNumber.trim(),
          physical_address: "",
          postal_address: "",
          representative_name: validatedData.firstName.trim(),
          representative_surname: validatedData.surname.trim(),
          company_contact: validatedData.contact.trim(),
          company_email: normalizedEmail,
          user_name: validatedData.firstName.trim(),
          user_surname: validatedData.surname.trim(),
          user_contact: validatedData.contact.trim(),
          user_email: normalizedEmail,
          domestic_name: validatedData.firstName.trim(),
          domestic_surname: validatedData.surname.trim(),
          domestic_id_number: validatedData.idNumber.trim(),
          domestic_contact: validatedData.contact.trim(),
          domestic_email: normalizedEmail,
        },
        { onConflict: "id" },
      );

      if (error) throw error;

      toast({
        title: "Success",
        description: "Personal details saved successfully.",
      });
      navigate("/dashboard");
    } catch (error: unknown) {
      const message = getSafeErrorMessage(error);
      setFormError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f7] px-6 py-8 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        <Card className="shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-black">User Details</CardTitle>
            <CardDescription className="text-[0.8rem]">
              Complete your personal details finalise your user account setup and continue to the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="font-semibold">
                    Name *
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    placeholder="Please enter your name"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surname" className="font-semibold">
                    Surname *
                  </Label>
                  <Input
                    id="surname"
                    name="surname"
                    placeholder="Please enter your surname"
                    value={formData.surname}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idNumber" className="font-semibold">
                    ID Number *
                  </Label>
                  <Input
                    id="idNumber"
                    name="idNumber"
                    placeholder="Please enter your ID number"
                    value={formData.idNumber}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact" className="font-semibold">
                    Contact Number *
                  </Label>
                  <Input
                    id="contact"
                    name="contact"
                    placeholder="Please enter your contact number"
                    value={formData.contact}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

              <div className="flex justify-center">
                <Button
                  type="submit"
                  className="bg-[#3eca44] text-white hover:bg-[#35b93d] sm:min-w-[200px]"
                  disabled={isLoading || !isFormValid}
                >
                  Continue
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanySetup;
