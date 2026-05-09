import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Check, ChevronsUpDown, FileText, User2 } from "lucide-react";

type DiscWarningGeneratorProps = {
  embedded?: boolean;
  externalNavigation?: boolean;
  onRequestClose?: () => void;
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

const stepShellCopy = [
  {
    eyebrow: "Step 1",
    title: "Client details shell",
    body: "This new disciplinary warning generator shell is active. The client and letterhead inputs will be rebuilt in the next phase.",
  },
  {
    eyebrow: "Step 2",
    title: "Employee details shell",
    body: "This stage is reserved for the new employee capture and selection flow, separate from the legacy warning generator implementation.",
  },
  {
    eyebrow: "Step 3",
    title: "Warning details shell",
    body: "This stage will hold the new misconduct, warning type, issue date, and supporting detail inputs once the generator rework starts.",
  },
  {
    eyebrow: "Preview",
    title: "Preview and download shell",
    body: "This placeholder confirms the new modal shell, stepper behavior, and footer controls before the real warning preview is implemented.",
  },
] as const;

const inputClassName =
  "h-8 rounded-sm border-slate-300 bg-white text-[11px] text-slate-900 shadow-none placeholder:text-[10px] placeholder:text-slate-400 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0";

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
  clientEmail: String(client.owner_email || client.primary_email || "").trim(),
  clientAddress: formatClientAddress(client),
});

const DiscWarningGeneratorContent = ({
  activeStep,
  isFinished,
  clientRows,
  clientForm,
  clientSearchOpen,
  setClientSearchOpen,
  onClientSelect,
  clientLoadMessage,
}: {
  activeStep: number;
  isFinished: boolean;
  clientRows: ClientRow[];
  clientForm: ClientFormState;
  clientSearchOpen: boolean;
  setClientSearchOpen: (open: boolean) => void;
  onClientSelect: (clientId: string) => void;
  clientLoadMessage: string;
}) => {
  const currentIndex = isFinished ? 3 : activeStep;
  const currentStep = stepShellCopy[currentIndex];
  const selectedClientLabel = clientForm.clientName || "Select client";
  const isClientStep = activeStep === 0 && !isFinished;

  return (
    <div className="h-full overflow-y-auto py-1">
      <div className="h-full">
        {!isClientStep ? (
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
        <div className={cn("space-y-4", isClientStep ? "pt-0" : "pt-5")}>
          {isClientStep ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="discWarningClientName" className="text-[10px] font-semibold text-slate-600">
                  Client Name
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
                  <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[420px] p-0">
                    <Command shouldFilter>
                      <CommandInput
                        placeholder="Search registered or trading name..."
                        className="h-8 text-[11px] placeholder:text-[10px]"
                      />
                      <CommandList className="max-h-[320px]">
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

              <div className="grid gap-4 md:grid-cols-2">
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
                <p className="text-sm font-medium text-slate-900">Rebuild target</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This shell is intentionally clean and isolated from the legacy warning generator so the new disciplinary warning workflow can be built without inherited contract or notice logic.
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
  onStepChange,
  onStepMetaChange,
}: DiscWarningGeneratorProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientLoadMessage, setClientLoadMessage] = useState("No clients found.");
  const [clientForm, setClientForm] = useState<ClientFormState>(emptyClientFormState);

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

  const handleClientSelect = (clientId: string) => {
    const client = clientRows.find((row) => row.id === clientId);
    if (!client) return;
    setClientForm(mapClientToFormState(client));
  };

  const stepMeta = useMemo(
    () => ({
      steps,
      activeStep: isFinished ? 3 : activeStep,
      icons: stepIcons,
      canGoNext: isFinished || (activeStep === 0 ? Boolean(clientForm.clientId) : activeStep <= 2),
      canGoBack: isFinished || activeStep > 0,
      canSelectStep: (index: number) => index >= 0 && index < 3,
      onNext: () => {
        if (isFinished) return;
        if (activeStep === 0 && !clientForm.clientId) return;
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
        setActiveStep(0);
        setClientForm(emptyClientFormState);
      },
      isFinished,
    }),
    [activeStep, clientForm.clientId, isFinished],
  );

  useEffect(() => {
    onStepMetaChange?.(stepMeta);
  }, [onStepMetaChange, stepMeta]);

  const content = (
    <DiscWarningGeneratorContent
      activeStep={activeStep}
      isFinished={isFinished}
      clientRows={clientRows}
      clientForm={clientForm}
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
