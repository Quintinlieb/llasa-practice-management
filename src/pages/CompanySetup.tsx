import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2, MapPin, RotateCcw, User2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { companySetupSchema, southAfricanProvinces } from "@/lib/validation";
import { getSafeErrorMessage } from "@/lib/errorHandling";

const CompanySetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [companyTypeError, setCompanyTypeError] = useState("");
  const [registrationNumberError, setRegistrationNumberError] = useState("");
  const [formData, setFormData] = useState({
    companyType: "",
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
  const stepLabels = ["Company Information", "Company Address", "Main User Details"];
  const stepIcons = [Building2, MapPin, User2] as const;
  const companyTypeSuffixes: Record<string, string> = {
    "(Pty) Ltd": "07",
    Ltd: "06",
    NPC: "08",
    Inc: "21",
    "SOC Ltd": "30",
    CC: "23",
  };

  // Route protection is handled by ProtectedRoute. Avoid redirecting here to prevent loops.
  useEffect(() => {
    if (!user?.email) return;
    setFormData((prev) => {
      if (prev.companyEmail.trim().length > 0 && prev.userEmail.trim().length > 0) return prev;
      return {
        ...prev,
        companyEmail: prev.companyEmail.trim().length > 0 ? prev.companyEmail : user.email ?? "",
        userEmail: prev.userEmail.trim().length > 0 ? prev.userEmail : user.email ?? "",
      };
    });
  }, [user?.email]);

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

  const handleCompanyTypeChange = (value: string) => {
    setCompanyTypeError("");
    setRegistrationNumberError(getRegistrationError(formData.registrationNumber, value));
    setFormData((prev) => ({
      ...prev,
      companyType: value,
    }));
  };

  const formatRegistrationNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    const part1 = digits.slice(0, 4);
    const part2 = digits.slice(4, 10);
    const part3 = digits.slice(10, 12);
    let formatted = part1;
    if (digits.length >= 4) {
      formatted += "/";
    }
    if (part2) formatted += part2;
    if (digits.length >= 10) {
      formatted += "/";
    }
    if (part3) formatted += part3;
    return formatted;
  };

  const handleCopyPostalAddress = () => {
    const parts = [
      formData.physicalAddressLine1.trim(),
      formData.physicalAddressLine2.trim(),
      formData.city.trim(),
      formData.province.trim(),
      formData.areaCode.trim(),
    ].filter(Boolean);
    setFormData((prev) => ({
      ...prev,
      postalAddress: parts.join(", "),
    }));
  };

  const handleResetStepFields = () => {
    setCompanyTypeError("");
    setRegistrationNumberError("");
    setFormData((prev) => {
      if (step === 0) {
        return {
          ...prev,
          companyType: "",
          companyName: "",
          registrationNumber: "",
          companyContact: "",
          companyEmail: prev.companyEmail,
        };
      }
      if (step === 1) {
        return {
          ...prev,
          physicalAddressLine1: "",
          physicalAddressLine2: "",
          city: "",
          province: "",
          areaCode: "",
          postalAddress: "",
        };
      }
      return {
        ...prev,
        userName: "",
        userSurname: "",
        userContact: "",
        userEmail: prev.userEmail,
      };
    });
  };

  const getRegistrationError = (value: string, companyType: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 12) return "";
    const expected = companyTypeSuffixes[companyType];
    if (expected && digits.slice(10, 12) !== expected) {
      return `Registration number ending must match selected company type (expected /${expected})`;
    }
    return "";
  };

  const isStepValid = () => {
    if (step === 0) {
      const registrationError = getRegistrationError(formData.registrationNumber, formData.companyType);
      const isRegistrationComplete = formData.registrationNumber.replace(/\D/g, "").length === 12;
      return (
        formData.companyType.trim().length > 0 &&
        formData.companyName.trim().length > 0 &&
        isRegistrationComplete &&
        !registrationError &&
        formData.companyContact.trim().length > 0 &&
        formData.companyEmail.trim().length > 0
      );
    }

    if (step === 1) {
      return (
        formData.physicalAddressLine2.trim().length > 0 &&
        formData.city.trim().length > 0 &&
        formData.areaCode.trim().length > 0
      );
    }

    return (
      formData.userName.trim().length > 0 &&
      formData.userSurname.trim().length > 0 &&
      formData.userContact.trim().length > 0 &&
      formData.userEmail.trim().length > 0
    );
  };

  const handleNext = () => {
    if (step === 0 && formData.companyType.trim().length === 0) {
      setCompanyTypeError("Company type is required");
      return;
    }
    if (step === 0) {
      const registrationDigits = formData.registrationNumber.replace(/\D/g, "");
      if (registrationDigits.length !== 12) {
        setRegistrationNumberError("Please enter a valid company registration number");
        return;
      }
      const registrationError = getRegistrationError(formData.registrationNumber, formData.companyType);
      setRegistrationNumberError(registrationError);
      if (registrationError) return;
    }
    setStep((current) => Math.min(current + 1, stepLabels.length - 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (step < stepLabels.length - 1) {
      if (isStepValid()) {
        handleNext();
      } else if (step === 0 && formData.companyType.trim().length === 0) {
        setCompanyTypeError("Company type is required");
        const registrationDigits = formData.registrationNumber.replace(/\D/g, "");
        if (registrationDigits.length !== 12) {
          setRegistrationNumberError("Please enter a valid company registration number");
        } else {
          setRegistrationNumberError(
            getRegistrationError(formData.registrationNumber, formData.companyType),
          );
        }
      }
      return;
    }

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
        company_type: validatedData.companyType,
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
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f7] py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-blue-700">Company Setup</CardTitle>
            <CardDescription className="text-[0.8rem]">
              Please complete your company profile in three easy steps to get started.
            </CardDescription>
            <div className="flex items-center justify-center gap-8 w-full py-6">
              {stepLabels.map((label, index) => {
                const Icon = stepIcons[index];
                const isDone = index < step;
                const isActive = index === step;
                const canClick = index < step;
                return (
                  <div key={label} className="flex items-center gap-4">
                    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={!canClick}
                            aria-label={label}
                            onClick={() => {
                              if (canClick) setStep(index);
                            }}
                            className={`flex flex-col items-start gap-1 transition ${
                              canClick
                                ? "cursor-pointer hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
                                : "cursor-default"
                            }`}
                          >
                            <span
                              className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                                isDone
                                  ? "border-[#b6e6c1] text-[#038314] bg-[#e9f9ee]"
                                  : isActive
                                    ? "border-blue-300 text-blue-700 bg-blue-100"
                                    : "border-slate-200 text-slate-500 bg-white"
                              }`}
                            >
                              <Icon className="h-6 w-6 -translate-y-[1px]" />
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center" className="text-xs">
                          {label}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {index < stepLabels.length - 1 ? (
                      <div
                        className={`h-px w-16 ${
                          index < step ? "bg-[#04b81f]" : "bg-slate-200"
                        }`}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className="w-fit rounded-md bg-blue-600 text-white border border-blue-600 text-xs py-1 px-3 hover:bg-blue-600 hover:text-white hover:border-blue-600">
                  {stepLabels[step]}
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  Step {step + 1} of {stepLabels.length}
                </span>
              </div>

              {step === 0 && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyType" className="font-semibold">Company Type *</Label>
                      <Select value={formData.companyType} onValueChange={handleCompanyTypeChange}>
                        <SelectTrigger
                          id="companyType"
                          aria-label="Company Type"
                          className={`company-type-select ${formData.companyType ? "text-sm" : "text-xs text-muted-foreground"}`}
                        >
                          <SelectValue placeholder="Please select the company type" />
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
                      {companyTypeError && (
                        <p className="text-sm text-destructive">{companyTypeError}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="font-semibold">Company Name *</Label>
                      <Input
                        id="companyName"
                        name="companyName"
                        placeholder="Please enter Registered Name"
                        value={formData.companyName}
                        onChange={handleChange}
                        required
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber" className="font-semibold">Registration Number *</Label>
                      <Input
                        id="registrationNumber"
                        name="registrationNumber"
                        placeholder="Please enter CIPC registration number"
                        value={formData.registrationNumber}
                        onChange={(e) =>
                          setFormData((prev) => {
                            const formatted = formatRegistrationNumber(e.target.value);
                            const digits = formatted.replace(/\D/g, "");
                            if (digits.length === 12) {
                              setRegistrationNumberError(
                                getRegistrationError(formatted, formData.companyType),
                              );
                            } else {
                              setRegistrationNumberError("");
                            }
                            return { ...prev, registrationNumber: formatted };
                          })
                        }
                        required
                        className="text-sm placeholder:text-xs"
                      />
                      {registrationNumberError && (
                        <p className="text-xs text-destructive">{registrationNumberError}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyContact" className="font-semibold">Contact Number *</Label>
                      <Input
                        id="companyContact"
                        name="companyContact"
                        placeholder="Please enter Company cell number"
                        value={formData.companyContact}
                        onChange={handleChange}
                        required
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="companyEmail" className="font-semibold">Company Email *</Label>
                      <Input
                        id="companyEmail"
                        name="companyEmail"
                        type="email"
                        placeholder="Please enter your company email address"
                        value={formData.companyEmail}
                        onChange={handleChange}
                        required
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="physicalAddressLine1" className="font-semibold">Physical Address Line 1</Label>
                      <Input
                        id="physicalAddressLine1"
                        name="physicalAddressLine1"
                        placeholder="Apartment/suite number and complex name"
                        value={formData.physicalAddressLine1}
                        onChange={handleChange}
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="physicalAddressLine2" className="font-semibold">Physical Address Line 2 *</Label>
                      <Input
                        id="physicalAddressLine2"
                        name="physicalAddressLine2"
                        placeholder="Street name and number"
                        value={formData.physicalAddressLine2}
                        onChange={handleChange}
                        required
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city" className="font-semibold">City *</Label>
                      <Input
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        required
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="province" className="font-semibold">Province *</Label>
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
                      <Label htmlFor="areaCode" className="font-semibold">Area Code *</Label>
                      <Input
                        id="areaCode"
                        name="areaCode"
                        value={formData.areaCode}
                        onChange={handleChange}
                        required
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                  <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="postalAddress" className="font-semibold">Postal Address</Label>
                        <button
                          type="button"
                          onClick={handleCopyPostalAddress}
                          className="ml-3 rounded-md border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-600 hover:border-blue-600 hover:text-blue-700 hover:no-underline"
                        >
                          Same as physical
                        </button>
                      </div>
                      <Input
                        id="postalAddress"
                        name="postalAddress"
                        value={formData.postalAddress}
                        onChange={handleChange}
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="userName" className="font-semibold">Name *</Label>
                      <Input
                        id="userName"
                        name="userName"
                        value={formData.userName}
                        onChange={handleChange}
                        required
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userSurname" className="font-semibold">Surname *</Label>
                      <Input
                        id="userSurname"
                        name="userSurname"
                        value={formData.userSurname}
                        onChange={handleChange}
                        required
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userContact" className="font-semibold">Contact Number *</Label>
                      <Input
                        id="userContact"
                        name="userContact"
                        value={formData.userContact}
                        onChange={handleChange}
                        required
                        className="text-sm placeholder:text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userEmail" className="font-semibold">Email *</Label>
                      <Input
                        id="userEmail"
                        name="userEmail"
                        type="email"
                        value={formData.userEmail}
                        onChange={handleChange}
                        required
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" onClick={handleBack} disabled={step === 0}>
                  Back
                </Button>
                <button
                  type="button"
                  onClick={handleResetStepFields}
                  className="mx-auto inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset fields
                </button>
                {step < stepLabels.length - 1 ? (
                  <Button type="button" onClick={handleNext} disabled={!isStepValid()}>
                    Next
                  </Button>
                ) : (
                  <Button type="submit" className="sm:min-w-[200px]" disabled={isLoading || !isStepValid()}>
                    {isLoading ? "Creating Profile..." : "Complete Setup"}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanySetup;
