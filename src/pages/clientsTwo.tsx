import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown, Plus, Search, User, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ClientsTwo = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [newClientStep, setNewClientStep] = useState<1 | 2 | 3>(1);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);

  const [clientDetailsForm, setClientDetailsForm] = useState({
    registeredName: "",
    tradingAs: "",
    registrationNumber: "",
    vatNumber: "",
    owner: "",
    telCell: "",
    email: "",
  });
  const [membershipForm, setMembershipForm] = useState({
    clientNumber: "LL00001",
    startDate: "",
    renewalDate: "",
    paymentCycle: "",
    memberTypes: [] as string[],
  });
  const [addressForm, setAddressForm] = useState({
    line1: "",
    line2: "",
    city: "",
    province: "",
    areaCode: "",
  });
  const [clientRows, setClientRows] = useState<any[]>([]);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [selectedClientRow, setSelectedClientRow] = useState<any | null>(null);
  const [isClientEditMode, setIsClientEditMode] = useState(false);
  const [isSavingClientEdit, setIsSavingClientEdit] = useState(false);
  const [clientEditForm, setClientEditForm] = useState({
    companyName: "",
    tradingAs: "",
    contactPerson: "",
    contactNumber: "",
    email: "",
    status: "",
  });

  const isStepOneComplete = Boolean(
    clientDetailsForm.registeredName.trim() &&
      clientDetailsForm.registrationNumber.trim() &&
      clientDetailsForm.owner.trim() &&
      clientDetailsForm.telCell.trim() &&
      clientDetailsForm.email.trim(),
  );
  const isStepTwoComplete = Boolean(
      membershipForm.clientNumber.trim() &&
      membershipForm.startDate.trim() &&
      membershipForm.paymentCycle.trim() &&
      membershipForm.memberTypes.length > 0,
  );
  const isStepThreeComplete = Boolean(
    addressForm.line1.trim() &&
      addressForm.city.trim() &&
      addressForm.province.trim() &&
      addressForm.areaCode.trim(),
  );

  const resetNewClientForm = () => {
    setNewClientStep(1);
    setClientDetailsForm({
      registeredName: "",
      tradingAs: "",
      registrationNumber: "",
      vatNumber: "",
      owner: "",
      telCell: "",
      email: "",
    });
    setMembershipForm({
      clientNumber: "LL00001",
      startDate: "",
      renewalDate: "",
      paymentCycle: "",
      memberTypes: [],
    });
    setAddressForm({
      line1: "",
      line2: "",
      city: "",
      province: "",
      areaCode: "",
    });
  };

  const handleNextStep = () => {
    if (newClientStep === 1 && !isStepOneComplete) return;
    if (newClientStep === 2 && !isStepTwoComplete) return;
    setNewClientStep((prev) => (prev < 3 ? ((prev + 1) as 1 | 2 | 3) : prev));
  };

  const canAccessStep = (step: 1 | 2 | 3) => {
    if (step === 1) return true;
    if (step === 2) return isStepOneComplete;
    return isStepOneComplete && isStepTwoComplete;
  };

  const goToStep = (step: 1 | 2 | 3) => {
    if (!canAccessStep(step)) return;
    setNewClientStep(step);
  };

  const formatDisplayDate = (value?: string) => {
    if (!value) return "";
    const [y, m, d] = value.split("-");
    if (!y || !m || !d) return value;
    return `${d}/${m}/${y}`;
  };

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  const stepOneDone = isStepOneComplete || newClientStep > 1;
  const stepTwoDone = isStepTwoComplete || newClientStep > 2;

  const stepCircleClass = (step: 1 | 2 | 3) => {
    const active = newClientStep === step;
    const done = step === 1 ? stepOneDone : step === 2 ? stepTwoDone : false;
    if (active || done) return "bg-[#3ec74a] text-white";
    return "bg-slate-400 text-white";
  };

  const stepLabelClass = (step: 1 | 2 | 3) => {
    if (newClientStep === step) return "text-slate-700";
    return "text-slate-500";
  };
  const addModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-slate-500 data-[state=open]:border-black data-[state=open]:bg-white";
  const addModalFieldInputClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
  const addModalFieldSelectTriggerClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black data-[state=open]:!border-black !ring-0 !ring-offset-0 !outline-none !shadow-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none";
  const addModalSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]";
  const membershipTypeOptions = [
    { label: "Labour Relations", value: "LR" },
    { label: "Employment Equity", value: "EE" },
    { label: "Payroll", value: "PR" },
    { label: "Occupational Health and Safety", value: "OHS" },
  ] as const;
  const membershipLabelByValue: Record<string, string> = {
    LR: "Labour Relations",
    EE: "Employment Equity",
    PR: "Payroll",
    OHS: "Occupational Health and Safety",
  };
  const tableRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return clientRows.filter((row) => {
      if (!q) return true;
      return [
        row.companyName,
        row.tradingAs,
        row.registrationNumber,
        row.contactPerson,
        row.contactNumber,
        row.email,
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [clientRows, searchQuery]);

  const mapClientRow = (row: any) => ({
    id: row.id,
    companyName: row.registered_name || "--",
    tradingAs: row.trading_as || row.trading_name || "--",
    registrationNumber: row.registration_number || "--",
    contactPerson: row.owner || "--",
    contactNumber: row.tel_cell || "--",
    email: row.client_email || "--",
    status: row.status ? String(row.status).replace(/^./, (s) => s.toUpperCase()) : "Active",
    memberTypes: Array.isArray(row.member_types) ? row.member_types.filter(Boolean) : [],
  });

  const fetchClients = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await (supabase as any)
      .from("clients")
      .select("*")
      .eq("company_id", user.id)
      .order("created_at", { ascending: false, nullsFirst: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setClientRows((data ?? []).map(mapClientRow));
  }, [toast, user?.id]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const handleCreateClient = async () => {
    if (!user?.id) return;
    if (!isStepOneComplete || !isStepTwoComplete || !isStepThreeComplete) return;
    setIsSavingClient(true);
    try {
      const normalizedCycle =
        membershipForm.paymentCycle.trim().toLowerCase() === "annually"
          ? "Annual"
          : membershipForm.paymentCycle.trim();
      const basePayload: Record<string, unknown> = {
        company_id: user.id,
        client_number: membershipForm.clientNumber.trim() || null,
        status: "active",
      };
      const optionalPayload: Record<string, unknown> = {
        registered_name: clientDetailsForm.registeredName.trim() || null,
        trading_as: clientDetailsForm.tradingAs.trim() || null,
        trading_name: clientDetailsForm.tradingAs.trim() || null,
        registration_number: clientDetailsForm.registrationNumber.trim() || null,
        vat_number: clientDetailsForm.vatNumber.trim() || null,
        owner: clientDetailsForm.owner.trim() || null,
        tel_cell: clientDetailsForm.telCell.trim() || null,
        client_email: clientDetailsForm.email.trim() || null,
        start_date: membershipForm.startDate.trim() || null,
        membership_period: normalizedCycle || null,
        retainer_cycle: normalizedCycle || null,
        member_types: membershipForm.memberTypes,
        physical_address_line1: addressForm.line1.trim() || null,
        physical_address_line2: addressForm.line2.trim() || null,
        city: addressForm.city.trim() || null,
        province: addressForm.province.trim() || null,
        area_code: addressForm.areaCode.trim() || null,
        bargaining_council: "None",
      };
      const payload: Record<string, unknown> = { ...basePayload, ...optionalPayload };

      const getMissingColumn = (error: any) => {
        const message = String(error?.message ?? "");
        const match = message.match(/'([^']+)' column/);
        return match?.[1] ?? null;
      };
      const tried = new Set<string>();
      while (true) {
        const { error } = await (supabase as any).from("clients").insert(payload);
        if (!error) break;
        const missingColumn = getMissingColumn(error);
        if (
          missingColumn &&
          Object.prototype.hasOwnProperty.call(payload, missingColumn) &&
          !Object.prototype.hasOwnProperty.call(basePayload, missingColumn) &&
          !tried.has(missingColumn)
        ) {
          delete payload[missingColumn];
          tried.add(missingColumn);
          continue;
        }
        throw error;
      }

      toast({ title: "Success", description: "Client created successfully." });
      setIsNewClientOpen(false);
      resetNewClientForm();
      await fetchClients();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Failed to create client.", variant: "destructive" });
    } finally {
      setIsSavingClient(false);
    }
  };

  const getClientStatusIndicator = (statusValue: string | undefined) => {
    const normalized = (statusValue || "").trim().toLowerCase();
    if (normalized.includes("suspend")) {
      return { label: "Suspended", dotClass: "bg-[#b88900]" };
    }
    if (normalized.includes("terminat") || normalized.includes("cancel")) {
      return { label: "Terminated", dotClass: "bg-rose-600" };
    }
    return { label: "Active", dotClass: "bg-[#3eca44]" };
  };

  const openClientFile = (row: any) => {
    setSelectedClientRow(row);
    setIsClientEditMode(false);
    setClientEditForm({
      companyName: row.companyName || "",
      tradingAs: row.tradingAs === "--" ? "" : row.tradingAs || "",
      contactPerson: row.contactPerson === "--" ? "" : row.contactPerson || "",
      contactNumber: row.contactNumber === "--" ? "" : row.contactNumber || "",
      email: row.email === "--" ? "" : row.email || "",
      status: row.status || "Active",
    });
  };

  const handleSaveClientEdits = async () => {
    if (!selectedClientRow?.id) return;
    setIsSavingClientEdit(true);
    try {
      const updatePayload: Record<string, unknown> = {
        registered_name: clientEditForm.companyName.trim() || null,
        trading_as: clientEditForm.tradingAs.trim() || null,
        trading_name: clientEditForm.tradingAs.trim() || null,
        owner: clientEditForm.contactPerson.trim() || null,
        tel_cell: clientEditForm.contactNumber.trim() || null,
        client_email: clientEditForm.email.trim() || null,
        status: clientEditForm.status.trim().toLowerCase() || "active",
      };
      const { error } = await (supabase as any)
        .from("clients")
        .update(updatePayload)
        .eq("id", selectedClientRow.id)
        .eq("company_id", user?.id);
      if (error) throw error;
      await fetchClients();
      setSelectedClientRow((prev: any) =>
        prev
          ? {
              ...prev,
              companyName: clientEditForm.companyName || "--",
              tradingAs: clientEditForm.tradingAs || "--",
              contactPerson: clientEditForm.contactPerson || "--",
              contactNumber: clientEditForm.contactNumber || "--",
              email: clientEditForm.email || "--",
              status: clientEditForm.status || "Active",
            }
          : prev,
      );
      setIsClientEditMode(false);
      toast({ title: "Success", description: "Client updated successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Failed to update client.", variant: "destructive" });
    } finally {
      setIsSavingClientEdit(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-[#3eca44] -ml-1">Cleints 2</h1>
                <p className="text-xs text-slate-600 mt-2">Browse, search, and manage your clients and attach their documents.</p>
              </div>
            </div>
            <section className="relative flex-1 min-h-0 overflow-hidden overflow-x-hidden pr-2">
              <div className="h-full min-h-0 p-0 flex flex-col">
                <Card className="rounded-none bg-white border-0 shadow-none h-full min-h-0 flex flex-col">
                  <CardHeader className="pl-4 pr-4 pt-5 pb-3 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="group relative w-full sm:w-[400px]">
                          <Input
                            placeholder="Search clients..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`h-8 rounded-sm border border-slate-200 bg-white !text-[11px] font-semibold shadow-sm transition-colors placeholder:!text-[11px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44] ${
                              searchQuery.trim().length > 0 ? "pr-20" : "pr-9"
                            }`}
                          />
                          {searchQuery.trim().length > 0 ? (
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-[#2f9f35] hover:underline"
                              onClick={() => setSearchQuery("")}
                            >
                              Clear
                            </button>
                          ) : (
                            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap sm:self-end">
                          <span className="text-slate-900">{tableRows.length > 0 ? `1-${tableRows.length}` : "0-0"}</span> of {clientRows.length} clients
                        </p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 w-24 justify-between rounded px-3 text-[11px] inline-flex items-center border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35] data-[state=open]:rounded-b-none data-[state=open]:border-[#3eca44]"
                            >
                              <span>Filter</span>
                              <ChevronDown className={`h-4 w-4 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="end" sideOffset={0} className="w-[220px] rounded-t-none border border-slate-200 border-t-0 bg-white p-3 shadow-lg">
                            <p className="text-[11px] text-slate-600">Filter options can be added here.</p>
                          </PopoverContent>
                        </Popover>
                        <Button
                          type="button"
                          onClick={() => setIsNewClientOpen(true)}
                          className="h-8 w-36 justify-between rounded-[4px] px-3 text-[11px] inline-flex items-center border border-[#3eca44] bg-[#3eca44] text-white hover:bg-[#34b73b]"
                        >
                          <span>New Client</span>
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pl-4 pr-4 pb-2 flex-1 min-h-0 overflow-hidden">
                    <div className="relative overflow-hidden rounded-sm border border-slate-200">
                      <div className="grid grid-cols-[0.39fr_2.1fr_1.9fr_1.3fr_1fr_2fr_0.75fr] items-center gap-2 border-b bg-[#2D4256] pl-1 pr-3 py-3 text-xs font-semibold text-white">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            indicator="x"
                            aria-label="Select all clients"
                            className="h-3 w-3 rounded-[2px] border-white/80 bg-white text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                          />
                        </div>
                        <div>Company Name</div>
                        <div>Trading As</div>
                        <div>Contact Person</div>
                        <div>Contact Number</div>
                        <div>Email</div>
                        <div>Status</div>
                      </div>

                      <div className="divide-y overflow-auto min-h-0" style={{ height: "calc(100dvh - var(--app-header-height,5rem) - 350px)" }}>
                        {tableRows.map((row) => (
                          <div key={row.id} className="grid w-full grid-cols-[0.39fr_2.1fr_1.9fr_1.3fr_1fr_2fr_0.75fr] items-center gap-2 pl-1 pr-3 py-2 text-left text-xs hover:bg-[#3eca44]/5">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                indicator="x"
                                aria-label={`Select ${row.companyName}`}
                                className="h-3 w-3 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                              />
                            </div>
                            <button type="button" onClick={() => openClientFile(row)} className="font-medium text-left hover:underline">
                              {row.companyName}
                            </button>
                            <div>{row.tradingAs}</div>
                            <div>{row.contactPerson}</div>
                            <div>{row.contactNumber}</div>
                            <div>{row.email}</div>
                            <div>{row.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Dialog
        open={isNewClientOpen}
        onOpenChange={(open) => {
          setIsNewClientOpen(open);
          if (!open) resetNewClientForm();
        }}
      >
        <DialogContent className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <User className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">New Client</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>

            <div className="mt-[46px] bg-white px-6 pb-6 pt-2">
              <div className="pt-0 pb-2"></div>
              <div className="mx-auto w-full max-w-[320px] py-4">
                <div className="relative grid grid-cols-3 items-start">
                  <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                  <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                  {(stepOneDone || newClientStep > 1) && <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-[#3eca44]" />}
                  {(stepTwoDone || newClientStep > 2) && <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-[#3eca44]" />}

                  {[{ step: 1 as const, label: "Client Details" }, { step: 2 as const, label: "Membership" }, { step: 3 as const, label: "Address" }].map((item) => {
                    const done = item.step === 1 ? stepOneDone : item.step === 2 ? stepTwoDone : false;
                    const active = newClientStep === item.step;
                    const canOpen = canAccessStep(item.step);
                    return (
                      <button
                        key={item.step}
                        type="button"
                        onClick={() => goToStep(item.step)}
                        disabled={!canOpen}
                        className={`z-10 flex flex-col items-center text-center ${canOpen ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${stepCircleClass(item.step)}`}>
                          {done && !active ? <Check className="h-3.5 w-3.5" /> : item.step}
                        </span>
                        <span className={`mt-3 text-[10px] font-semibold ${stepLabelClass(item.step)}`}>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

              </div>
              <form
                  className="space-y-4 pt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newClientStep < 3) handleNextStep();
                  }}
                >
                  <div className="h-[330px] pr-1">
                  {newClientStep === 1 && (
                    <div className="w-full space-y-4">
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Registered Name <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company registered name" value={clientDetailsForm.registeredName} onChange={(e) => setClientDetailsForm((p) => ({ ...p, registeredName: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Trading as</span>
                        <Input className={addModalFieldInputClass} placeholder="Insert trading name" value={clientDetailsForm.tradingAs} onChange={(e) => setClientDetailsForm((p) => ({ ...p, tradingAs: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Registration Number <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company registration number" value={clientDetailsForm.registrationNumber} onChange={(e) => setClientDetailsForm((p) => ({ ...p, registrationNumber: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">VAT Number</span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company vat number" value={clientDetailsForm.vatNumber} onChange={(e) => setClientDetailsForm((p) => ({ ...p, vatNumber: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Owner <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert owner's name and surname" value={clientDetailsForm.owner} onChange={(e) => setClientDetailsForm((p) => ({ ...p, owner: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Tell / Cell <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company contact number" value={clientDetailsForm.telCell} onChange={(e) => setClientDetailsForm((p) => ({ ...p, telCell: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Email <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company email" value={clientDetailsForm.email} onChange={(e) => setClientDetailsForm((p) => ({ ...p, email: e.target.value }))} />
                      </div>
                    </div>
                  )}

                  {newClientStep === 2 && (
                    <div className="w-full space-y-4">
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Client Number <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} value={membershipForm.clientNumber} onChange={(e) => setMembershipForm((p) => ({ ...p, clientNumber: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Start Date <span className="text-red-600">*</span></span>
                        <Input
                          type="text"
                          readOnly
                          className={addModalFieldInputClass}
                          placeholder="Please select a date"
                          value={membershipForm.startDate ? formatDisplayDate(membershipForm.startDate) : ""}
                          onClick={() => openDatePicker(startDateInputRef.current)}
                          onFocus={() => openDatePicker(startDateInputRef.current)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openDatePicker(startDateInputRef.current);
                            }
                          }}
                        />
                        <input
                          ref={startDateInputRef}
                          type="date"
                          value={membershipForm.startDate}
                          onChange={(e) => setMembershipForm((p) => ({ ...p, startDate: e.target.value }))}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Payment Cycle <span className="text-red-600">*</span></span>
                        <Select value={membershipForm.paymentCycle || undefined} onValueChange={(value) => setMembershipForm((p) => ({ ...p, paymentCycle: value }))}>
                          <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass}`}>
                            <SelectValue placeholder="Please select payment cycle" />
                          </SelectTrigger>
                          <SelectContent className="text-[11px]">
                            <SelectItem value="Monthly" className={addModalSelectItemClass}>Monthly</SelectItem>
                            <SelectItem value="Annual" className={addModalSelectItemClass}>Annual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Member Type <span className="text-red-600">*</span></span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                                className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} w-full justify-between px-3 hover:bg-white hover:text-slate-700`}
                            >
                              <span className={`truncate text-left ${membershipForm.memberTypes.length === 0 ? "text-[10px] text-slate-400" : ""}`}>
                                {membershipForm.memberTypes.length > 0 ? membershipForm.memberTypes.join(", ") : "Select member type(s)"}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-[320px] text-[11px]">
                            {membershipTypeOptions.map((memberType) => {
                              const isChecked = membershipForm.memberTypes.includes(memberType.value);
                              return (
                                <DropdownMenuCheckboxItem
                                  key={memberType.value}
                                  checked={isChecked}
                                  onSelect={(event) => event.preventDefault()}
                                  onCheckedChange={() =>
                                    setMembershipForm((prev) => ({
                                      ...prev,
                                      memberTypes: prev.memberTypes.includes(memberType.value)
                                        ? prev.memberTypes.filter((value) => value !== memberType.value)
                                        : [...prev.memberTypes, memberType.value],
                                    }))
                                  }
                                  className="cursor-pointer text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35]"
                                >
                                  <span className="flex w-full items-center justify-between gap-3">
                                    <span>{memberType.label}</span>
                                    <span className="text-[10px] font-semibold text-slate-500">{memberType.value}</span>
                                  </span>
                                </DropdownMenuCheckboxItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}

                  {newClientStep === 3 && (
                    <div className="w-full space-y-4">
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Address Line 1 <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Please insert address line 1" value={addressForm.line1} onChange={(e) => setAddressForm((p) => ({ ...p, line1: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Address Line 2</span>
                        <Input className={addModalFieldInputClass} placeholder="Please insert address line 2" value={addressForm.line2} onChange={(e) => setAddressForm((p) => ({ ...p, line2: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">City <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Please insert city" value={addressForm.city} onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Province <span className="text-red-600">*</span></span>
                        <Select value={addressForm.province || undefined} onValueChange={(value) => setAddressForm((p) => ({ ...p, province: value }))}>
                          <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass}`}>
                            <SelectValue placeholder="Please select province" />
                          </SelectTrigger>
                          <SelectContent className="text-[11px]">
                            <SelectItem value="Gauteng" className={addModalSelectItemClass}>Gauteng</SelectItem>
                            <SelectItem value="Limpopo" className={addModalSelectItemClass}>Limpopo</SelectItem>
                            <SelectItem value="Mpumalanga" className={addModalSelectItemClass}>Mpumalanga</SelectItem>
                            <SelectItem value="North West" className={addModalSelectItemClass}>North West</SelectItem>
                            <SelectItem value="Free State" className={addModalSelectItemClass}>Free State</SelectItem>
                            <SelectItem value="KwaZulu-Natal" className={addModalSelectItemClass}>KwaZulu-Natal</SelectItem>
                            <SelectItem value="Western Cape" className={addModalSelectItemClass}>Western Cape</SelectItem>
                            <SelectItem value="Eastern Cape" className={addModalSelectItemClass}>Eastern Cape</SelectItem>
                            <SelectItem value="Northern Cape" className={addModalSelectItemClass}>Northern Cape</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Area Code <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Please insert area code" value={addressForm.areaCode} onChange={(e) => setAddressForm((p) => ({ ...p, areaCode: e.target.value }))} />
                      </div>
                    </div>
                  )}
                  </div>

                  <div className="mt-6 grid grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
                    <div className="justify-self-start">
                      {newClientStep > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-[28px] w-[84px] rounded border-[#3eca44] px-3 text-xs text-[#3eca44] hover:bg-transparent hover:text-[#3eca44]"
                          onClick={() => setNewClientStep((prev) => (prev === 1 ? prev : ((prev - 1) as 1 | 2 | 3)))}
                        >
                          Back
                        </Button>
                      )}
                    </div>
                    <div className="justify-self-center">
                      <Button type="button" variant="ghost" className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline" onClick={resetNewClientForm}>
                        Clear
                      </Button>
                    </div>
                    <div className="justify-self-end">
                      {newClientStep < 3 ? (
                        <Button
                          type="submit"
                          className="h-[28px] w-[84px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
                          disabled={(newClientStep === 1 && !isStepOneComplete) || (newClientStep === 2 && !isStepTwoComplete)}
                        >
                          Next
                        </Button>
                      ) : (
                        <Button type="button" onClick={() => void handleCreateClient()} className="h-[30px] w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]" disabled={!isStepThreeComplete || isSavingClient}>
                          {isSavingClient ? "Saving..." : "Add"}
                        </Button>
                      )}
                    </div>
                  </div>
                </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedClientRow && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/65"
            aria-label="Close client file"
            onClick={() => setSelectedClientRow(null)}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <section className="relative z-10 w-[94vw] max-w-[980px] h-[92vh] rounded-sm bg-[#2D4256] shadow-2xl overflow-hidden border-0">
              <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">Client File</h2>
                </div>
                <button type="button" className="text-white hover:text-white/80" onClick={() => setSelectedClientRow(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-[46px] h-[calc(92vh-46px)] overflow-y-auto bg-white px-4 pb-4 pt-2">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {(() => {
                        const statusIndicator = getClientStatusIndicator(selectedClientRow.status);
                        return (
                          <div className="mb-0 inline-flex items-center gap-1.5 text-[10px] leading-none font-semibold text-slate-600">
                            <span className={`h-2 w-2 rounded-full ${statusIndicator.dotClass}`} />
                            <span>{statusIndicator.label}</span>
                          </div>
                        );
                      })()}
                      <h2 className="text-2xl font-semibold text-slate-900">{selectedClientRow.companyName}</h2>
                      {selectedClientRow.tradingAs && selectedClientRow.tradingAs !== "--" ? (
                        <p className="text-xs text-slate-500">t/a {selectedClientRow.tradingAs}</p>
                      ) : null}
                      {Array.isArray(selectedClientRow.memberTypes) && selectedClientRow.memberTypes.length > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {selectedClientRow.memberTypes.map((service: string) => (
                            <span
                              key={service}
                              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-[#3eca44] hover:text-[#2f9f35]"
                            >
                              {membershipLabelByValue[service] ?? service}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        onClick={() => {
                          if (isClientEditMode) {
                            void handleSaveClientEdits();
                          } else {
                            setIsClientEditMode(true);
                          }
                        }}
                        disabled={isSavingClientEdit}
                      >
                        {isSavingClientEdit ? "Saving..." : isClientEditMode ? "Save" : "Edit"}
                      </Button>
                    </div>
                  </div>

                  <Tabs defaultValue="company" className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-slate-100">
                      <TabsTrigger value="company" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Company</TabsTrigger>
                      <TabsTrigger value="membership" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Membership</TabsTrigger>
                      <TabsTrigger value="notes" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Notes</TabsTrigger>
                      <TabsTrigger value="matters" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Matters</TabsTrigger>
                      <TabsTrigger value="documents" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Documents</TabsTrigger>
                    </TabsList>

                    <TabsContent value="company" className="mt-4">
                      <div className="grid gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[10px] text-slate-500">Company Name</p>
                          {isClientEditMode ? (
                            <Input className="mt-1 h-8 text-[11px]" value={clientEditForm.companyName} onChange={(e) => setClientEditForm((p) => ({ ...p, companyName: e.target.value }))} />
                          ) : (
                            <p className="font-medium text-slate-900">{selectedClientRow.companyName}</p>
                          )}
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[10px] text-slate-500">Trading As</p>
                          {isClientEditMode ? (
                            <Input className="mt-1 h-8 text-[11px]" value={clientEditForm.tradingAs} onChange={(e) => setClientEditForm((p) => ({ ...p, tradingAs: e.target.value }))} />
                          ) : (
                            <p className="font-medium text-slate-900">{selectedClientRow.tradingAs}</p>
                          )}
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[10px] text-slate-500">Contact Person</p>
                          {isClientEditMode ? (
                            <Input className="mt-1 h-8 text-[11px]" value={clientEditForm.contactPerson} onChange={(e) => setClientEditForm((p) => ({ ...p, contactPerson: e.target.value }))} />
                          ) : (
                            <p className="font-medium text-slate-900">{selectedClientRow.contactPerson}</p>
                          )}
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[10px] text-slate-500">Contact Number</p>
                          {isClientEditMode ? (
                            <Input className="mt-1 h-8 text-[11px]" value={clientEditForm.contactNumber} onChange={(e) => setClientEditForm((p) => ({ ...p, contactNumber: e.target.value }))} />
                          ) : (
                            <p className="font-medium text-slate-900">{selectedClientRow.contactNumber}</p>
                          )}
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[10px] text-slate-500">Email</p>
                          {isClientEditMode ? (
                            <Input className="mt-1 h-8 text-[11px]" value={clientEditForm.email} onChange={(e) => setClientEditForm((p) => ({ ...p, email: e.target.value }))} />
                          ) : (
                            <p className="font-medium text-slate-900">{selectedClientRow.email}</p>
                          )}
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[10px] text-slate-500">Status</p>
                          {isClientEditMode ? (
                            <Select value={clientEditForm.status} onValueChange={(value) => setClientEditForm((p) => ({ ...p, status: value }))}>
                              <SelectTrigger className="mt-1 h-8 text-[11px]"><SelectValue /></SelectTrigger>
                              <SelectContent className="text-[11px]">
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Suspended">Suspended</SelectItem>
                                <SelectItem value="Cancelled">Cancelled</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="font-medium text-slate-900">{selectedClientRow.status}</p>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="membership" className="mt-4">
                      <div className="grid gap-2 text-xs sm:grid-cols-2">
                        {[
                          ["Services", Array.isArray(selectedClientRow.memberTypes) && selectedClientRow.memberTypes.length > 0 ? selectedClientRow.memberTypes.join(", ") : "--"],
                          ["Status", selectedClientRow.status],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="rounded border border-slate-200 bg-slate-50 p-2">
                            <p className="text-[10px] text-slate-500">{label}</p>
                            <p className="font-medium text-slate-900">{value}</p>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="notes" className="mt-4">
                      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No notes yet.</div>
                    </TabsContent>

                    <TabsContent value="matters" className="mt-4">
                      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No matters linked yet.</div>
                    </TabsContent>

                    <TabsContent value="documents" className="mt-4">
                      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No documents uploaded yet.</div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ClientsTwo;

