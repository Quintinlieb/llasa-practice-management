import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { logGeneratedDocument } from "@/lib/documentsLog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { Building2, Check, ChevronsUpDown, FileText, User2, X } from "lucide-react";

type DiscWarningGeneratorProps = {
  embedded?: boolean;
  externalNavigation?: boolean;
  onRequestClose?: () => void;
  draftState?: unknown;
  onDraftStateChange?: (draftState: unknown) => void;
  onStepChange?: (step: string | null) => void;
  onStepMetaChange?: (meta: {
    steps: readonly string[];
    activeStep: number;
    icons?: readonly ComponentType<SVGProps<SVGSVGElement>>[];
    canGoNext?: boolean;
    canGoBack?: boolean;
    canSelectStep?: (index: number) => boolean;
    onNext?: () => void;
    onBack?: () => void;
    onStepSelect?: (index: number) => void;
    onClear?: () => void;
    addendumType?: "general" | "renewal" | "extension" | "";
    isFinished?: boolean;
    isPreviewEditable?: boolean;
    supportsPreviewEditToggle?: boolean;
    supportsResetAtFirstStep?: boolean;
    temporaryEmployeeCount?: number;
  }) => void;
};

const steps = [
  "Client Details",
  "Employee Details",
  "Warning Details",
  "Preview / Download",
] as const;

const stepIcons = [Building2, User2, FileText, Check] as const;

type OffenceCategory = "Minor" | "Serious" | "Dismissible";

type ConductOffence = {
  name: string;
  category: OffenceCategory;
  firstOutcome: string;
};

type ClientRow = {
  id: string;
  registered_name: string | null;
  trading_as: string | null;
  company_type: string | null;
  registration_number: string | null;
  client_number: string | null;
  owner_number: string | null;
  primary_number: string | null;
  owner_email: string | null;
  primary_email: string | null;
  physical_address_line1: string | null;
  physical_address_line2: string | null;
  city: string | null;
  province: string | null;
  area_code: string | null;
};

type ClientFormState = {
  clientId: string;
  clientName: string;
  registrationNumber: string;
  clientContactNumber: string;
  clientEmail: string;
  clientAddress: string;
};

const emptyClientFormState: ClientFormState = {
  clientId: "",
  clientName: "",
  registrationNumber: "",
  clientContactNumber: "",
  clientEmail: "",
  clientAddress: "",
};

type EmployeeFormState = {
  employeeName: string;
  employeeSurname: string;
  employeeIdOrPassportNumber: string;
  jobTitle: string;
};

const emptyEmployeeFormState: EmployeeFormState = {
  employeeName: "",
  employeeSurname: "",
  employeeIdOrPassportNumber: "",
  jobTitle: "",
};

type WarningFormState = {
  misconductTypes: string[];
  misconductDescription: string;
  warningType: "first" | "second" | "serious" | "final" | "";
  validityPeriod: string;
  issuedBy: string;
};

const emptyWarningFormState: WarningFormState = {
  misconductTypes: [],
  misconductDescription: "",
  warningType: "",
  validityPeriod: "",
  issuedBy: "Management",
};

type DiscWarningGeneratorDraftState = {
  activeStep: number;
  isFinished: boolean;
  clientForm: ClientFormState;
  employeeForm: EmployeeFormState;
  warningForm: WarningFormState;
};

const isDiscWarningGeneratorDraftState = (value: unknown): value is DiscWarningGeneratorDraftState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.activeStep !== "number" || typeof candidate.isFinished !== "boolean") return false;
  if (!candidate.clientForm || typeof candidate.clientForm !== "object") return false;
  return true;
};

const normalizeClientFormState = (value: unknown): ClientFormState => ({
  ...emptyClientFormState,
  ...((value && typeof value === "object" ? value : {}) as Partial<ClientFormState>),
});

const normalizeEmployeeFormState = (value: unknown): EmployeeFormState => ({
  ...emptyEmployeeFormState,
  ...((value && typeof value === "object" ? value : {}) as Partial<EmployeeFormState>),
});

const normalizeWarningFormState = (value: unknown): WarningFormState => {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<WarningFormState>;
  return {
    ...emptyWarningFormState,
    ...candidate,
    misconductTypes: Array.isArray(candidate.misconductTypes)
      ? candidate.misconductTypes.filter((item): item is string => typeof item === "string")
      : [],
  };
};

const stepShellCopy = [
  {
    eyebrow: "Step 1",
    title: "Client details",
    body: "Select the client and review the company information that will be used in this warning.",
  },
  {
    eyebrow: "Step 2",
    title: "Employee details",
    body: "Capture the employee details that will appear in the warning.",
  },
  {
    eyebrow: "Step 3",
    title: "Warning details",
    body: "Select the misconduct type or types and complete the warning information for this document.",
  },
  {
    eyebrow: "Preview",
    title: "Preview and download",
    body: "Review the warning before finalising and downloading it.",
  },
] as const;

const inputClassName =
  "h-8 rounded-sm border-slate-300 bg-white !text-[10px] md:!text-[10px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] md:placeholder:!text-[10px] placeholder:font-normal placeholder:text-slate-400 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0";

const companyTypeSuffixByValue: Record<string, string> = {
  "Private Company ((Pty) Ltd)": "(Pty) Ltd",
  "Public Company (Ltd)": "Ltd",
  "Personal Liability Company (Inc.)": "Inc.",
  "State-Owned Company (SOC Ltd)": "SOC Ltd",
  "Non-Profit Company (NPC)": "NPC",
  "Close Corporation (CC)": "CC",
  "Co-operative (Co-op)": "Co-op",
  "Sole Proprietor (SP)": "SP",
  "Partnership (Partnership)": "Partnership",
  "Business Trust (Trust)": "Trust",
};

const appendCompanyTypeSuffix = (registeredName: string, companyType: string) => {
  const suffix = companyTypeSuffixByValue[companyType] || "";
  if (!suffix) return registeredName;
  const normalizedName = registeredName.toLowerCase();
  const normalizedSuffix = suffix.toLowerCase();
  if (normalizedName.endsWith(normalizedSuffix)) return registeredName;
  return `${registeredName} ${suffix}`;
};

const formatClientDisplayName = (client: ClientRow) => {
  const registeredName = String(client.registered_name || "").trim();
  const companyType = String(client.company_type || "").trim();
  const tradingName = String(client.trading_as || "").trim();
  const registeredNameWithType = registeredName ? appendCompanyTypeSuffix(registeredName, companyType) : "";
  if (
    registeredNameWithType &&
    tradingName &&
    tradingName.toLowerCase() !== registeredName.toLowerCase() &&
    tradingName.toLowerCase() !== registeredNameWithType.toLowerCase()
  ) {
    return `${registeredNameWithType} t/a ${tradingName}`;
  }
  return registeredNameWithType || tradingName || "Unnamed client";
};

const formatClientAddress = (client: ClientRow) =>
  [
    client.physical_address_line1,
    client.physical_address_line2,
    client.city,
    client.province,
    client.area_code,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

const mapClientToFormState = (client: ClientRow): ClientFormState => ({
  clientId: client.id,
  clientName: formatClientDisplayName(client),
  registrationNumber: String(client.registration_number || "").trim(),
  clientContactNumber: String(client.primary_number || "").trim(),
  clientEmail: String(client.primary_email || "").trim(),
  clientAddress: formatClientAddress(client),
});

const offenceCategoryOrder: OffenceCategory[] = ["Minor", "Serious", "Dismissible"];

const offenceGroupLabel: Record<OffenceCategory, string> = {
  Minor: "Minor Offences",
  Serious: "Serious Offences",
  Dismissible: "Dismissible Offences",
};

const warningValidityByType: Record<Exclude<WarningFormState["warningType"], "">, string> = {
  first: "6",
  second: "6",
  serious: "9",
  final: "12",
};

const warningTypeLabelByValue: Record<Exclude<WarningFormState["warningType"], "">, string> = {
  first: "First Written Warning",
  second: "Second Written Warning",
  serious: "Serious Written Warning",
  final: "Final Written Warning",
};

const generatedDocumentsBucket = "documents";
const employeeIdOrPassportMaxLength = 13;

const DiscWarningGeneratorContent = ({
  activeStep,
  isFinished,
  clientRows,
  clientForm,
  employeeForm,
  warningForm,
  onEmployeeFormChange,
  onWarningFormChange,
  onWarningTypeChange,
  misconductSearchOpen,
  setMisconductSearchOpen,
  conductOffences,
  misconductLoadMessage,
  onMisconductToggle,
  clientSearchOpen,
  setClientSearchOpen,
  onClientSelect,
  clientLoadMessage,
}: {
  activeStep: number;
  isFinished: boolean;
  clientRows: ClientRow[];
  clientForm: ClientFormState;
  employeeForm: EmployeeFormState;
  warningForm: WarningFormState;
  onEmployeeFormChange: (field: keyof EmployeeFormState, value: string) => void;
  onWarningFormChange: (field: Exclude<keyof WarningFormState, "misconductTypes" | "warningType">, value: string) => void;
  onWarningTypeChange: (value: Exclude<WarningFormState["warningType"], "">) => void;
  misconductSearchOpen: boolean;
  setMisconductSearchOpen: (open: boolean) => void;
  conductOffences: ConductOffence[];
  misconductLoadMessage: string;
  onMisconductToggle: (name: string) => void;
  clientSearchOpen: boolean;
  setClientSearchOpen: (open: boolean) => void;
  onClientSelect: (clientId: string) => void;
  clientLoadMessage: string;
}) => {
  const currentIndex = isFinished ? 3 : activeStep;
  const currentStep = stepShellCopy[currentIndex];
  const selectedClientLabel = clientForm.clientName || "Select client";
  const isClientStep = activeStep === 0 && !isFinished;
  const isEmployeeStep = activeStep === 1 && !isFinished;
  const isWarningStep = activeStep === 2 && !isFinished;
  const isPreviewStep = isFinished;
  const misconductSelectionLabel =
    warningForm.misconductTypes.length === 0
      ? "Select misconduct type(s)"
      : warningForm.misconductTypes.length === 1
        ? warningForm.misconductTypes[0]
        : `${warningForm.misconductTypes.length} misconduct type(s) selected`;
  const warningTypeLabel = warningForm.warningType ? warningTypeLabelByValue[warningForm.warningType] : "";
  const previewLine = "______________________________";
  const employeeFullName = [employeeForm.employeeName, employeeForm.employeeSurname].filter(Boolean).join(" ").trim();
  const employerRows = [
    { label: "Company Name:", value: clientForm.clientName || previewLine },
    { label: "Registration No:", value: clientForm.registrationNumber || previewLine },
    { label: "Employer Number:", value: clientForm.clientContactNumber || previewLine },
    { label: "Employer Email:", value: clientForm.clientEmail || previewLine },
    { label: "Employer Address:", value: clientForm.clientAddress || previewLine },
  ];
  const employeeRows = [
    { label: "Employee Name:", value: employeeFullName || previewLine },
    { label: "ID Number:", value: employeeForm.employeeIdOrPassportNumber || previewLine },
  ];
  const warningRows = [
    {
      label: "Offence(s):",
      value: warningForm.misconductTypes.length > 0 ? warningForm.misconductTypes.join(", ") : previewLine,
    },
    { label: "Description:", value: warningForm.misconductDescription || previewLine },
    { label: "Warning Type:", value: warningTypeLabel || previewLine },
    {
      label: "Validity Period:",
      value: warningForm.validityPeriod ? `${warningForm.validityPeriod} months` : previewLine,
    },
    { label: "Issued By:", value: warningForm.issuedBy || previewLine },
  ];
  const signatureRows = [
    ["Employer/Issuer", "Date", "Employee", "Date"],
    ["Representative", "Date", "Interpreter", "Date"],
    ["Witness 1 (optional)", "Date", "Witness 2 (optional)", "Date"],
  ] as const;

  return (
    <div className="h-full overflow-y-auto py-1">
      <div className="h-full">
        {!isClientStep && !isEmployeeStep && !isWarningStep && !isPreviewStep ? (
          <div className="space-y-3 border-b border-slate-100 pb-5">
            <Badge variant="outline" className="w-fit border-[#2D4256]/20 text-[#2D4256]">
              {currentStep.eyebrow}
            </Badge>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">{currentStep.title}</h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">{currentStep.body}</p>
            </div>
          </div>
        ) : null}
        <div className={cn("space-y-4", isClientStep || isEmployeeStep ? "pt-0" : "pt-5")}>
          {isClientStep ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="discWarningClientName" className="text-[10px] font-semibold text-slate-600">
                    Client Name <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="discWarningClientName"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientSearchOpen}
                        className={cn(
                          inputClassName,
                          "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                          !clientForm.clientName && "text-[10px]",
                          !clientForm.clientName && "text-slate-400",
                        )}
                      >
                        <span className="truncate">{selectedClientLabel}</span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] overflow-hidden p-0"
                      onWheel={(event) => event.stopPropagation()}
                    >
                      <Command shouldFilter>
                        <CommandInput
                          placeholder="Search registered or trading name..."
                          className="h-8 text-[11px] placeholder:text-[10px]"
                        />
                        <CommandList className="max-h-[320px] overscroll-contain">
                          <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{clientLoadMessage}</CommandEmpty>
                          <CommandGroup>
                            {clientRows.map((client) => {
                              const label = formatClientDisplayName(client);
                              const searchable = `${String(client.registered_name || "").trim()} ${String(client.trading_as || "").trim()}`;
                              return (
                                <CommandItem
                                  key={client.id}
                                  value={`${label} ${searchable}`}
                                  onSelect={() => {
                                    onClientSelect(client.id);
                                    setClientSearchOpen(false);
                                  }}
                                  className="flex items-center justify-between gap-3 px-3 py-2 text-[10px]"
                                >
                                  <p className="min-w-0 truncate text-[10px] font-medium text-slate-900">{label}</p>
                                  {clientForm.clientId === client.id ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discWarningRegistrationNumber" className="text-[10px] font-semibold text-slate-600">
                    Registration Number
                  </Label>
                  <Input
                    id="discWarningRegistrationNumber"
                    value={clientForm.registrationNumber}
                    readOnly
                    placeholder="Will populate from selected client"
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discWarningClientContactNumber" className="text-[10px] font-semibold text-slate-600">
                    Contact Number
                  </Label>
                  <Input
                    id="discWarningClientContactNumber"
                    value={clientForm.clientContactNumber}
                    readOnly
                    placeholder="Will populate from selected client"
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discWarningClientEmail" className="text-[10px] font-semibold text-slate-600">
                    Client Email
                  </Label>
                  <Input
                    id="discWarningClientEmail"
                    value={clientForm.clientEmail}
                    readOnly
                    placeholder="Will populate from selected client"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningClientAddress" className="text-[10px] font-semibold text-slate-600">
                  Client Address
                </Label>
                <Input
                  id="discWarningClientAddress"
                  value={clientForm.clientAddress}
                  readOnly
                  placeholder="Will populate from selected client"
                  className={inputClassName}
                />
              </div>
            </>
          ) : isEmployeeStep ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discWarningEmployeeName" className="text-[10px] font-semibold text-slate-600">
                  Employee Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="discWarningEmployeeName"
                  value={employeeForm.employeeName}
                  onChange={(event) => onEmployeeFormChange("employeeName", event.target.value)}
                  placeholder="Enter employee name"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningEmployeeSurname" className="text-[10px] font-semibold text-slate-600">
                  Employee Surname <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="discWarningEmployeeSurname"
                  value={employeeForm.employeeSurname}
                  onChange={(event) => onEmployeeFormChange("employeeSurname", event.target.value)}
                  placeholder="Enter employee surname"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningEmployeeIdOrPassportNumber" className="text-[10px] font-semibold text-slate-600">
                  Employee ID/Passport Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="discWarningEmployeeIdOrPassportNumber"
                  value={employeeForm.employeeIdOrPassportNumber}
                  onChange={(event) => onEmployeeFormChange("employeeIdOrPassportNumber", event.target.value)}
                  placeholder="Enter employee ID or passport number"
                  maxLength={employeeIdOrPassportMaxLength}
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningEmployeeJobTitle" className="text-[10px] font-semibold text-slate-600">
                  Job Title
                </Label>
                <Input
                  id="discWarningEmployeeJobTitle"
                  value={employeeForm.jobTitle}
                  onChange={(event) => onEmployeeFormChange("jobTitle", event.target.value)}
                  placeholder="Enter job title"
                  className={inputClassName}
                />
              </div>
            </div>
          ) : isWarningStep ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discWarningMisconductTypes" className="text-[10px] font-semibold text-slate-600">
                  Misconduct Type(s) <span className="text-red-500">*</span>
                </Label>
                <Popover open={misconductSearchOpen} onOpenChange={setMisconductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="discWarningMisconductTypes"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={misconductSearchOpen}
                      className={cn(
                        inputClassName,
                        "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                        warningForm.misconductTypes.length === 0 && "text-[10px] text-slate-400",
                      )}
                    >
                      <span className="truncate text-left">{misconductSelectionLabel}</span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="flex max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] flex-col overflow-hidden p-0"
                    onWheel={(event) => event.stopPropagation()}
                  >
                    <Command shouldFilter>
                      <CommandInput
                        placeholder="Search misconduct types..."
                        className="h-8 text-[11px] placeholder:text-[10px]"
                      />
                      <CommandList className="max-h-[248px] overscroll-contain">
                        <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{misconductLoadMessage}</CommandEmpty>
                        {offenceCategoryOrder.map((category) => {
                          const offences = conductOffences.filter((offence) => offence.category === category);
                          if (offences.length === 0) return null;
                          return (
                            <CommandGroup
                              key={category}
                              heading={offenceGroupLabel[category]}
                              className="px-1 [&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:border-slate-200 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-slate-900"
                            >
                              {offences.map((offence) => {
                                const isSelected = warningForm.misconductTypes.includes(offence.name);
                                return (
                                  <CommandItem
                                    key={`${category}-${offence.name}`}
                                    value={`${offenceGroupLabel[category]} ${offence.name}`}
                                    onSelect={() => onMisconductToggle(offence.name)}
                                    className={cn(
                                      "flex items-center justify-between gap-3 px-3 py-2 text-[10px]",
                                      isSelected ? "text-[#2f9f35]" : "text-slate-600",
                                    )}
                                  >
                                    <p
                                      className={cn(
                                        "min-w-0 truncate text-[10px] font-medium",
                                        isSelected ? "text-[#2f9f35]" : "text-slate-600",
                                      )}
                                    >
                                      {offence.name}
                                    </p>
                                    {isSelected ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          );
                        })}
                      </CommandList>
                    </Command>
                    <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
                      {warningForm.misconductTypes.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {warningForm.misconductTypes.map((type) => (
                            <div
                              key={type}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#3eca44] bg-[#3eca44]/10 px-2.5 py-1 text-[10px] font-medium text-[#2f9f35]"
                            >
                              <span className="truncate">{type}</span>
                              <button
                                type="button"
                                aria-label={`Remove ${type}`}
                                onClick={() => onMisconductToggle(type)}
                                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#2f9f35] transition-colors hover:text-[#237a28]"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500">No misconduct types selected.</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {warningForm.misconductTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {warningForm.misconductTypes.map((type) => (
                      <div
                        key={type}
                        className="group inline-flex items-center rounded-sm border border-[#3eca44] bg-[#3eca44]/10 px-2 py-1 text-[10px] font-medium text-[#2f9f35] transition-all"
                      >
                        <span>{type}</span>
                        <span className="inline-flex w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:ml-1 group-hover:w-3.5 group-hover:opacity-100 group-focus-within:ml-1 group-focus-within:w-3.5 group-focus-within:opacity-100">
                          <button
                            type="button"
                            aria-label={`Remove ${type}`}
                            onClick={() => onMisconductToggle(type)}
                            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#2f9f35] hover:text-[#237a28]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningMisconductDescription" className="text-[10px] font-semibold text-slate-600">
                  Misconduct Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="discWarningMisconductDescription"
                  value={warningForm.misconductDescription}
                  onChange={(event) => onWarningFormChange("misconductDescription", event.target.value)}
                  placeholder="Provide specific details about the misconduct incident(s)"
                  rows={5}
                  className={`${inputClassName} min-h-[120px] resize-none py-2`}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="discWarningWarningType" className="text-[10px] font-semibold text-slate-600">
                    Warning Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={warningForm.warningType || undefined}
                    onValueChange={(value) => onWarningTypeChange(value as Exclude<WarningFormState["warningType"], "">)}
                  >
                    <SelectTrigger
                      id="discWarningWarningType"
                      className={cn(
                        inputClassName,
                        "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
                      )}
                    >
                      <SelectValue placeholder="Select warning type" />
                    </SelectTrigger>
                    <SelectContent className="text-[10px]">
                      <SelectItem value="first" className="text-[10px]">First Written Warning</SelectItem>
                      <SelectItem value="second" className="text-[10px]">Second Written Warning</SelectItem>
                      <SelectItem value="serious" className="text-[10px]">Serious Written Warning</SelectItem>
                      <SelectItem value="final" className="text-[10px]">Final Written Warning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discWarningValidityPeriod" className="text-[10px] font-semibold text-slate-600">
                    Validity Period <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="discWarningValidityPeriod"
                    value={warningForm.validityPeriod ? `${warningForm.validityPeriod} months` : ""}
                    readOnly
                    placeholder="Will populate from warning type"
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discWarningIssuedBy" className="text-[10px] font-semibold text-slate-600">
                    Issued By
                  </Label>
                  <Input
                    id="discWarningIssuedBy"
                    value={warningForm.issuedBy}
                    onChange={(event) => onWarningFormChange("issuedBy", event.target.value)}
                    placeholder="Enter issuer name"
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>
          ) : isPreviewStep ? (
            <div className="mx-auto max-w-[820px]">
              <div className="bg-white px-8 pt-3 pb-8 text-black">
                <h2 className="text-center text-[20px] font-bold uppercase tracking-tight text-black">
                  {warningTypeLabel || "Disciplinary Warning Form"}
                </h2>

                <section className="mt-5">
                  <div className="rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase text-black">A. Employer Details</p>
                  </div>
                  <div className="mt-3 space-y-1">
                    {employerRows.map((row) => (
                      <div key={row.label} className="grid grid-cols-[176px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
                        <p className="font-bold text-black">{row.label}</p>
                        <p className="text-black">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-6">
                  <div className="rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase text-black">B. Employee Details</p>
                  </div>
                  <div className="mt-3 space-y-1">
                    {employeeRows.map((row) => (
                      <div key={row.label} className="grid grid-cols-[176px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
                        <p className="font-bold text-black">{row.label}</p>
                        <p className="text-black">{row.value}</p>
                      </div>
                    ))}
                    {employeeForm.jobTitle ? (
                      <div className="grid grid-cols-[176px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
                        <p className="font-bold text-black">Job Title:</p>
                        <p className="text-black">{employeeForm.jobTitle}</p>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="mt-6">
                  <div className="rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase text-black">C. Warning Details</p>
                  </div>
                  <div className="mt-3 space-y-1">
                    {warningRows.map((row) => (
                      <div key={row.label} className="grid grid-cols-[176px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
                        <p className="font-bold text-black">{row.label}</p>
                        <p className="whitespace-pre-wrap text-black">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-6">
                  <div className="rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase text-black">D. Consequences</p>
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-black">
                    You are required to refrain completely from committing any further acts of misconduct. Should you
                    commit the same or similar act of misconduct within the validity period of this warning,
                    progressive disciplinary action will be taken which could lead to your dismissal.
                  </p>
                </section>

                <section className="mt-6">
                  <div className="rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase text-black">E. Signatures</p>
                  </div>
                  <div className="mt-3 space-y-6">
                    {signatureRows.map((row, index) => (
                      <div
                        key={index}
                        className="grid max-w-full grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)_92px] gap-x-6 gap-y-1.5"
                      >
                        {row.map((label) => (
                          <div key={label} className="min-w-0">
                            <div className="border-b border-black" />
                            <p className="mt-1.5 text-[11px] text-black">{label}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-sm border border-slate-300 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] italic leading-5 text-slate-700">
                      If the employee refuses to sign this warning, the witness&apos;s signature will confirm that the
                      employee did receive the warning and that the contents were explained to him/her.
                    </p>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {steps.slice(0, 3).map((stepLabel, index) => {
                  const isCurrent = !isFinished && activeStep === index;
                  const isComplete = isFinished || activeStep > index;
                  const Icon = stepIcons[index];
                  return (
                    <div
                      key={stepLabel}
                      className={cn(
                        "rounded-sm border px-4 py-4 transition-colors",
                        isCurrent
                          ? "border-[#2D4256] bg-slate-50"
                          : isComplete
                            ? "border-[#3eca44]/40 bg-[#3eca44]/10"
                            : "border-slate-200 bg-white",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-full border",
                            isCurrent
                              ? "border-[#2D4256] bg-[#2D4256] text-white"
                              : isComplete
                                ? "border-[#3eca44] bg-[#3eca44] text-white"
                                : "border-slate-200 bg-slate-50 text-slate-400",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage {index + 1}</p>
                          <p className="text-sm font-semibold text-slate-900">{stepLabel}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
                <p className="text-sm font-medium text-slate-900">Preview step</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This preview area will show the completed warning content before download.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DiscWarningGenerator = ({
  embedded = false,
  draftState,
  onDraftStateChange,
  onStepChange,
  onStepMetaChange,
}: DiscWarningGeneratorProps) => {
  const { user } = useAuth();
  const resolvedDraftState = isDiscWarningGeneratorDraftState(draftState) ? draftState : null;
  const [activeStep, setActiveStep] = useState(resolvedDraftState?.activeStep ?? 0);
  const [isFinished, setIsFinished] = useState(resolvedDraftState?.isFinished ?? false);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientLoadMessage, setClientLoadMessage] = useState("No clients found.");
  const [clientForm, setClientForm] = useState<ClientFormState>(() =>
    normalizeClientFormState(resolvedDraftState?.clientForm),
  );
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(() =>
    normalizeEmployeeFormState(resolvedDraftState?.employeeForm),
  );
  const [warningForm, setWarningForm] = useState<WarningFormState>(() =>
    normalizeWarningFormState(resolvedDraftState?.warningForm),
  );
  const [misconductSearchOpen, setMisconductSearchOpen] = useState(false);
  const [conductOffences, setConductOffences] = useState<ConductOffence[]>([]);
  const [misconductLoadMessage, setMisconductLoadMessage] = useState("No misconduct types found.");

  const currentStepLabel = isFinished ? steps[3] : steps[activeStep];

  useEffect(() => {
    onStepChange?.(currentStepLabel);
  }, [currentStepLabel, onStepChange]);

  useEffect(() => {
    let isMounted = true;

    const loadClients = async () => {
      const { data, error } = await (supabase as any)
        .from("clients")
        .select(
          "id,registered_name,trading_as,company_type,registration_number,client_number,owner_number,primary_number,owner_email,primary_email,physical_address_line1,physical_address_line2,city,province,area_code",
        )
        .order("registered_name", { ascending: true, nullsFirst: false });

      if (!isMounted) return;

      if (error) {
        setClientRows([]);
        setClientLoadMessage(`Unable to load clients: ${error.message}`);
        return;
      }

      const nextRows = ((data as ClientRow[] | null) ?? []).sort((a, b) =>
        formatClientDisplayName(a).localeCompare(formatClientDisplayName(b), undefined, {
          sensitivity: "base",
        }),
      );

      setClientRows(nextRows);
      setClientLoadMessage(nextRows.length > 0 ? "No matching clients found." : "No clients found.");
    };

    void loadClients();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const loadConductOffences = async () => {
      const { data, error } = await (supabase as any)
        .from("company_code_of_conduct")
        .select("data")
        .eq("company_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        setConductOffences([]);
        setMisconductLoadMessage(`Unable to load misconduct types: ${error.message}`);
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
              (offence.category as OffenceCategory | undefined) ?? sectionCategory ?? "Serious";
            return { name, category, firstOutcome: offence.first ?? "" };
          });
        })
        .filter((item): item is ConductOffence => Boolean(item?.name));

      const deduped = offenceCategoryOrder.flatMap((category) => {
        const seen = new Set<string>();
        return mapped.filter((item) => {
          if (item.category !== category) return false;
          const key = item.name.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });

      setConductOffences(deduped);
      setMisconductLoadMessage(deduped.length > 0 ? "No matching misconduct types found." : "No misconduct types found.");
    };

    void loadConductOffences();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleClientSelect = (clientId: string) => {
    const client = clientRows.find((row) => row.id === clientId);
    if (!client) return;
    setClientForm(mapClientToFormState(client));
  };

  const handleEmployeeFormChange = (field: keyof EmployeeFormState, value: string) => {
    setEmployeeForm((current) => ({
      ...current,
      [field]: field === "employeeIdOrPassportNumber" ? value.slice(0, employeeIdOrPassportMaxLength) : value,
    }));
  };

  const handleWarningFormChange = (
    field: Exclude<keyof WarningFormState, "misconductTypes" | "warningType">,
    value: string,
  ) => {
    setWarningForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleWarningTypeChange = (value: Exclude<WarningFormState["warningType"], "">) => {
    setWarningForm((current) => ({
      ...current,
      warningType: value,
      validityPeriod: warningValidityByType[value],
    }));
  };

  const handleMisconductToggle = (name: string) => {
    setWarningForm((current) => ({
      ...current,
      misconductTypes: current.misconductTypes.includes(name)
        ? current.misconductTypes.filter((item) => item !== name)
        : [...current.misconductTypes, name],
    }));
  };

  const handleDownloadPdf = async () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const bottomLimit = pageHeight - 18;
    const sectionFill = [239, 242, 246] as const;
    const sectionBorder = [203, 213, 225] as const;
    const lineFallback = "______________________________";
    const resolvedTitle = warningTypeLabelByValue[warningForm.warningType || "first"] ?? "Disciplinary Warning Form";
    const resolvedEmployeeName =
      [employeeForm.employeeName, employeeForm.employeeSurname].filter(Boolean).join(" ").trim() || lineFallback;
    const resolvedEmployerRows = [
      ["Company Name:", clientForm.clientName || lineFallback],
      ["Registration No:", clientForm.registrationNumber || lineFallback],
      ["Employer Number:", clientForm.clientContactNumber || lineFallback],
      ["Employer Email:", clientForm.clientEmail || lineFallback],
      ["Employer Address:", clientForm.clientAddress || lineFallback],
    ] as const;
    const resolvedEmployeeRows = [
      ["Employee Name:", resolvedEmployeeName],
      ["ID Number:", employeeForm.employeeIdOrPassportNumber || lineFallback],
    ] as const;
    const resolvedWarningRows = [
      ["Offence(s):", warningForm.misconductTypes.length > 0 ? warningForm.misconductTypes.join(", ") : lineFallback],
      ["Description:", warningForm.misconductDescription || lineFallback],
      ["Validity Period:", warningForm.validityPeriod ? `${warningForm.validityPeriod} months` : lineFallback],
      ["Issued By:", warningForm.issuedBy || lineFallback],
    ] as const;
    const signatureRows = [
      ["Employer/Issuer", "Date", "Employee", "Date"],
      ["Representative", "Date", "Interpreter", "Date"],
      ["Witness 1 (optional)", "Date", "Witness 2 (optional)", "Date"],
    ] as const;
    const consequenceText =
      "You are required to refrain completely from committing any further acts of misconduct. Should you commit the same or similar act of misconduct within the validity period of this warning, progressive disciplinary action will be taken which could lead to your dismissal.";
    const witnessNote =
      "If the employee refuses to sign this warning, the witness's signature will confirm that the employee did receive the warning and that the contents were explained to him/her.";

    let y = 14;

    const ensureSpace = (needed: number) => {
      if (y + needed <= bottomLimit) return;
      doc.addPage();
      y = 18;
    };

    const drawSectionHeader = (title: string) => {
      ensureSpace(10);
      doc.setDrawColor(...sectionBorder);
      doc.setFillColor(...sectionFill);
      doc.roundedRect(margin, y, contentWidth, 8.5, 0.8, 0.8, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(title, margin + 4.5, y + 5.4);
      y += 15;
    };

    const drawKeyValueRows = (
      rows: readonly (readonly [string, string])[],
      options?: { extraTopByLabel?: Partial<Record<string, number>> },
    ) => {
      const labelWidth = 42;
      const valueWidth = contentWidth - labelWidth - 4;
      const lineHeight = 3.7;
      rows.forEach(([label, value]) => {
        const extraTop = options?.extraTopByLabel?.[label] ?? 0;
        if (extraTop > 0) {
          ensureSpace(extraTop);
          y += extraTop;
        }
        const valueLines = doc.splitTextToSize(value, valueWidth);
        const rowHeight = Math.max(4.2, valueLines.length * lineHeight);
        ensureSpace(rowHeight);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(label, margin, y);
        doc.setFont("helvetica", "normal");
        valueLines.forEach((line, index) => {
          const lineY = y + index * lineHeight;
          const isLastLine = index === valueLines.length - 1;
          const words = String(line).trim().split(/\s+/).filter(Boolean);
          if (isLastLine || words.length <= 1) {
            doc.text(String(line), margin + labelWidth, lineY);
            return;
          }
          const lineWidth = doc.getTextWidth(String(line));
          const extraSpace = valueWidth - lineWidth;
          const gapCount = words.length - 1;
          let x = margin + labelWidth;
          words.forEach((word, wordIndex) => {
            doc.text(word, x, lineY);
            x += doc.getTextWidth(word);
            if (wordIndex < gapCount) {
              x += doc.getTextWidth(" ") + extraSpace / gapCount;
            }
          });
        });
        y += rowHeight + 0.5;
      });
    };

    const drawJustifiedParagraph = (text: string, lineHeight = 4.9) => {
      const lines = doc.splitTextToSize(text, contentWidth) as string[];
      lines.forEach((line, index) => {
        ensureSpace(lineHeight);
        const isLastLine = index === lines.length - 1;
        const words = line.trim().split(/\s+/).filter(Boolean);
        if (isLastLine || words.length <= 1) {
          doc.text(line, margin, y);
          y += lineHeight;
          return;
        }
        const lineWidth = doc.getTextWidth(line);
        const extraSpace = contentWidth - lineWidth;
        const gapCount = words.length - 1;
        let x = margin;
        words.forEach((word, wordIndex) => {
          doc.text(word, x, y);
          x += doc.getTextWidth(word);
          if (wordIndex < gapCount) {
            x += doc.getTextWidth(" ") + extraSpace / gapCount;
          }
        });
        y += lineHeight;
      });
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(resolvedTitle.toUpperCase(), pageWidth / 2, y, { align: "center" });
    y += 10;

    drawSectionHeader("A. EMPLOYER DETAILS");
    drawKeyValueRows(resolvedEmployerRows);

    y += 4;
    drawSectionHeader("B. EMPLOYEE DETAILS");
    drawKeyValueRows(resolvedEmployeeRows);
    if (employeeForm.jobTitle.trim()) {
      drawKeyValueRows([["Job Title:", employeeForm.jobTitle.trim()]]);
    }

    y += 4;
    drawSectionHeader("C. WARNING DETAILS");
    drawKeyValueRows(resolvedWarningRows, { extraTopByLabel: { "Validity Period:": 0.6 } });

    y += 4;
    drawSectionHeader("D. CONSEQUENCES");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    drawJustifiedParagraph(consequenceText, 3.7);

    y += 4;
    drawSectionHeader("E. SIGNATURES");
    y += 10;

    const signatureGap = 10;
    const totalSignatureGap = signatureGap * 3;
    const availableSignatureWidth = contentWidth - totalSignatureGap;
    const signatureColumnWidths = [
      availableSignatureWidth * 0.35,
      availableSignatureWidth * 0.15,
      availableSignatureWidth * 0.35,
      availableSignatureWidth * 0.15,
    ];
    signatureRows.forEach((row) => {
      ensureSpace(19);
      let x = margin;
      row.forEach((label, index) => {
        const width = signatureColumnWidths[index];
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.line(x, y, x + width, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(label, x, y + 4.2);
        x += width + signatureGap;
      });
      y += 17;
    });

    ensureSpace(12);
    doc.setDrawColor(...sectionBorder);
    doc.setFillColor(...sectionFill);
    doc.roundedRect(margin, y, contentWidth, 11, 0.8, 0.8, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(witnessNote, contentWidth - 6);
    const noteLineHeight = 3.7;
    const noteTextHeight = noteLines.length * noteLineHeight;
    const noteStartY = y + (11 - noteTextHeight) / 2 + 3;
    doc.text(noteLines, margin + 3, noteStartY);

    const fileTitle =
      (warningForm.warningType ? warningTypeLabelByValue[warningForm.warningType] : "Disciplinary Warning Form")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "disciplinary-warning-form";
    const employeeInitial = employeeForm.employeeName.trim().charAt(0).toUpperCase();
    const employeeSurname = employeeForm.employeeSurname.trim();
    const documentNameSuffix =
      employeeInitial && employeeSurname ? ` (${employeeInitial} ${employeeSurname})` : "";
    const warningLabel = warningForm.warningType ? warningTypeLabelByValue[warningForm.warningType] : "Warning";
    const documentName = `${warningLabel}${documentNameSuffix}`;
    const downloadFileName = `${fileTitle}.pdf`;
    const uploadBlob = doc.output("blob");
    const uploadSafeClientName =
      (clientForm.clientName || "client")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "client";
    const uploadSafeDocumentName =
      documentName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "warning";
    const uploadFilePath = [
      "warnings-2",
      uploadSafeClientName,
      `${Date.now()}-${uploadSafeDocumentName}.pdf`,
    ].join("/");
    let uploadedFileUrl = "";

    const { error: uploadError } = await supabase.storage
      .from(generatedDocumentsBucket)
      .upload(uploadFilePath, uploadBlob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      });

    if (uploadError) {
      toast({
        title: "Upload Error",
        description: `Could not save document file: ${uploadError.message}`,
        variant: "destructive",
      });
    } else {
      const { data: publicUrlData } = supabase.storage.from(generatedDocumentsBucket).getPublicUrl(uploadFilePath);
      uploadedFileUrl = String(publicUrlData?.publicUrl ?? "").trim();
    }

    const logResult = await logGeneratedDocument({
      documentLabel: warningLabel,
      documentName,
      documentType: "Warning",
      clientName: clientForm.clientName,
      fileUrl: uploadedFileUrl,
      createdByName: user
        ? `${String((user as any)?.user_metadata?.user_name || "").trim()} ${String((user as any)?.user_metadata?.user_surname || "").trim()}`.trim()
        : "",
      employeeName: employeeForm.employeeName,
      employeeSurname: employeeForm.employeeSurname,
    });

    if (!logResult.ok) {
      toast({
        title: "Save Error",
        description: `Could not save document row: ${logResult.error}`,
        variant: "destructive",
      });
    } else {
      window.dispatchEvent(new CustomEvent("documents-row-created"));
    }

    doc.save(downloadFileName);
  };

  const isEmployeeStepComplete =
    employeeForm.employeeName.trim().length > 0 &&
    employeeForm.employeeSurname.trim().length > 0 &&
    employeeForm.employeeIdOrPassportNumber.trim().length > 0;
  const isWarningStepComplete =
    warningForm.misconductTypes.length > 0 &&
    warningForm.misconductDescription.trim().length > 0 &&
    Boolean(warningForm.warningType) &&
    warningForm.validityPeriod.trim().length > 0;

  const stepMeta = useMemo(
    () => ({
      steps,
      activeStep: isFinished ? 3 : activeStep,
      icons: stepIcons,
      canGoNext:
        isFinished ||
        (activeStep === 0
          ? Boolean(clientForm.clientId)
          : activeStep === 1
            ? isEmployeeStepComplete
            : activeStep === 2
              ? isWarningStepComplete
              : activeStep <= 2),
      canGoBack: isFinished || activeStep > 0,
      canSelectStep: (index: number) => index >= 0 && index < 3,
      onNext: () => {
        if (isFinished) {
          handleDownloadPdf();
          return;
        }
        if (activeStep === 0 && !clientForm.clientId) return;
        if (activeStep === 1 && !isEmployeeStepComplete) return;
        if (activeStep === 2 && !isWarningStepComplete) return;
        if (activeStep < 2) {
          setActiveStep((current) => Math.min(current + 1, 2));
          return;
        }
        setIsFinished(true);
      },
      onBack: () => {
        if (isFinished) {
          setIsFinished(false);
          return;
        }
        setActiveStep((current) => Math.max(current - 1, 0));
      },
      onStepSelect: (index: number) => {
        setIsFinished(false);
        setActiveStep(Math.max(0, Math.min(index, 2)));
      },
      onClear: () => {
        setIsFinished(false);
        if (activeStep === 0) {
          setClientForm(emptyClientFormState);
          setClientSearchOpen(false);
          return;
        }
        if (activeStep === 1) {
          setEmployeeForm(emptyEmployeeFormState);
          return;
        }
        if (activeStep === 2) {
          setWarningForm(emptyWarningFormState);
          setMisconductSearchOpen(false);
        }
      },
      isFinished,
      supportsResetAtFirstStep: activeStep === 0 && Boolean(clientForm.clientId),
    }),
    [
      activeStep,
      clientForm.clientId,
      handleDownloadPdf,
      isEmployeeStepComplete,
      isFinished,
      isWarningStepComplete,
    ],
  );

  useEffect(() => {
    onStepMetaChange?.(stepMeta);
  }, [onStepMetaChange, stepMeta]);

  useEffect(() => {
    onDraftStateChange?.({
      activeStep,
      isFinished,
      clientForm,
      employeeForm,
      warningForm,
    } satisfies DiscWarningGeneratorDraftState);
  }, [activeStep, clientForm, employeeForm, isFinished, onDraftStateChange, warningForm]);

  const content = (
    <DiscWarningGeneratorContent
      activeStep={activeStep}
      isFinished={isFinished}
      clientRows={clientRows}
      clientForm={clientForm}
      employeeForm={employeeForm}
      warningForm={warningForm}
      onEmployeeFormChange={handleEmployeeFormChange}
      onWarningFormChange={handleWarningFormChange}
      onWarningTypeChange={handleWarningTypeChange}
      misconductSearchOpen={misconductSearchOpen}
      setMisconductSearchOpen={setMisconductSearchOpen}
      conductOffences={conductOffences}
      misconductLoadMessage={misconductLoadMessage}
      onMisconductToggle={handleMisconductToggle}
      clientSearchOpen={clientSearchOpen}
      setClientSearchOpen={setClientSearchOpen}
      onClientSelect={handleClientSelect}
      clientLoadMessage={clientLoadMessage}
    />
  );

  if (embedded) {
    return content;
  }

  return <DashboardLayout profileSubtitleMode="company">{content}</DashboardLayout>;
};

export default DiscWarningGenerator;
