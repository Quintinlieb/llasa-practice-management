import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Printer, Save, Edit2, ArrowLeft, Plus, Loader2, Trash2, X } from "lucide-react";

type OffenceRow = {
  name: string;
  first: string;
  second?: string;
  third?: string;
  fourth?: string;
};

type OffenceSection = {
  id: string;
  title: string;
  offences: OffenceRow[];
};

type FixedCategoryId = "minor" | "serious" | "dismissible";

const fixedCategoryOrder: FixedCategoryId[] = ["minor", "serious", "dismissible"];

const fixedCategoryDefinitions: Record<FixedCategoryId, { title: string; offences: OffenceRow[] }> = {
  minor: {
    title: "Minor Offences",
    offences: [
      {
        name: "Arriving late for work",
        first: "First Written Warning",
        second: "Second Written Warning",
        third: "Final Written Warning",
      },
      {
        name: "Leaving early without permission",
        first: "First Written Warning",
        second: "First Written Warning",
        third: "Second Written Warning",
      },
      {
        name: "Failing to clock in/out",
        first: "First Written Warning",
        second: "Second Written Warning",
        third: "Serious Written Warning",
      },
      {
        name: "Poor housekeeping or hygiene",
        first: "First Written Warning",
        second: "Second Written Warning",
        third: "Final Written Warning",
      },
      {
        name: "Failure to follow basic procedures",
        first: "First Written Warning",
        second: "Second Written Warning",
        third: "Final Written Warning",
      },
    ],
  },
  serious: {
    title: "Serious Offences",
    offences: [
      {
        name: "Failure to carry out lawful and reasonable instructions",
        first: "First Written Warning",
        second: "Final Written Warning",
        third: "Dismissal",
      },
      {
        name: "Gross insolence or abusive language",
        first: "Final Written Warning",
        second: "Dismissal",
      },
      {
        name: "Negligence causing potential harm",
        first: "First Written Warning",
        second: "Final Written Warning",
        third: "Dismissal",
      },
      {
        name: "Serious breach of safety procedures",
        first: "Final Written Warning",
        second: "Dismissal",
      },
      {
        name: "Harassment or discrimination",
        first: "Final Written Warning",
        second: "Dismissal",
      },
    ],
  },
  dismissible: {
    title: "Dismissible Offences",
    offences: [
      {
        name: "Bribery / Fraud / Dishonesty",
        first: "Dismissal",
      },
      {
        name: "Theft or attempted theft",
        first: "Dismissal",
      },
      {
        name: "Serious damage to company property",
        first: "Dismissal",
      },
      {
        name: "Sleeping on duty (Security Officers)",
        first: "Dismissal",
      },
      {
        name: "Possession of alcohol or drugs on duty",
        first: "Final Written Warning",
        second: "Dismissal",
      },
    ],
  },
};

const cloneSections = (value: OffenceSection[]): OffenceSection[] =>
  value.map((section) => ({
    ...section,
    offences: section.offences.map((offence) => ({ ...offence })),
  }));

type OffenceUndoPayload = {
  kind: "offence";
  sectionId: string;
  row: OffenceRow;
  index: number;
};

type UndoAction = OffenceUndoPayload & {
  expiresAt: number;
};

const actionOptions = [
  "First Written Warning",
  "Second Written Warning",
  "Serious Written Warning",
  "Final Written Warning",
  "Dismissal",
] as const;

const createFixedSections = (): OffenceSection[] =>
  fixedCategoryOrder.map((id) => ({
    id,
    title: fixedCategoryDefinitions[id].title,
    offences: fixedCategoryDefinitions[id].offences.map((offence) => ({ ...offence })),
  }));

const initialSections: OffenceSection[] = createFixedSections();

const resolveCategoryId = (section: OffenceSection): FixedCategoryId | null => {
  if (fixedCategoryOrder.includes(section.id as FixedCategoryId)) {
    return section.id as FixedCategoryId;
  }
  const normalizedTitle = section.title.trim().toLowerCase();
  const found = fixedCategoryOrder.find(
    (categoryId) => fixedCategoryDefinitions[categoryId].title.trim().toLowerCase() === normalizedTitle,
  );
  return found ?? null;
};

const normalizeSections = (value?: OffenceSection[] | null): OffenceSection[] => {
  const defaults = createFixedSections();
  if (!value || value.length === 0) {
    return defaults;
  }
  const lookup = defaults.reduce<Record<FixedCategoryId, OffenceSection>>((acc, section) => {
    acc[section.id as FixedCategoryId] = section;
    return acc;
  }, {} as Record<FixedCategoryId, OffenceSection>);

  value.forEach((section) => {
    const categoryId = resolveCategoryId(section);
    if (!categoryId) return;
    lookup[categoryId] = {
      id: categoryId,
      title: fixedCategoryDefinitions[categoryId].title,
      offences: section.offences.map((offence) => ({ ...offence })),
    };
  });

  return fixedCategoryOrder.map((id) => lookup[id]);
};

const gridColumns = [
  { key: "name", label: "Offence", placeholder: "e.g. Arriving late for work" },
  { key: "first", label: "1st", placeholder: "Outcome for 1st offence" },
  { key: "second", label: "2nd", placeholder: "Outcome for 2nd offence" },
  { key: "third", label: "3rd", placeholder: "Outcome for 3rd offence" },
  { key: "fourth", label: "4th", placeholder: "Outcome for 4th offence" },
] as const;

export default function CodeOfConductPreviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [sections, setSections] = useState<OffenceSection[]>([]);
  const [snapshot, setSnapshot] = useState<OffenceSection[] | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isRemoteLoading, setIsRemoteLoading] = useState(true);
  const [undoState, setUndoState] = useState<UndoAction | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const printStyles = useMemo(
    () => `
      @media print {
        #code-of-conduct-preview {
          max-width: 100%;
          padding: 0;
        }
        .no-print {
          display: none !important;
        }
        .print-section {
          page-break-inside: avoid;
        }
      }
    `,
    [],
  );

  const persistSections = useCallback(
    async (nextSections: OffenceSection[]) => {
      if (!user) {
        throw new Error("You must be signed in to save changes.");
      }
      const payload = normalizeSections(nextSections);
      const { error } = await supabase.from("company_code_of_conduct").upsert({
        company_id: user.id,
        data: { sections: payload },
        updated_at: new Date().toISOString(),
      });
      if (error) {
        throw error;
      }
      return payload;
    },
    [user],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsRemoteLoading(false);
      return;
    }

    const loadSections = async () => {
      setIsRemoteLoading(true);
      try {
        const { data, error } = await supabase
          .from("company_code_of_conduct")
          .select("data")
          .eq("company_id", user.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        const payload = (data?.data as { sections?: OffenceSection[] } | null) ?? null;
        const storedSections = payload?.sections ?? null;

        if (!storedSections || storedSections.length === 0) {
          const defaults = cloneSections(initialSections);
          const savedDefaults = await persistSections(defaults);
          setSections(savedDefaults);
          setSnapshot(cloneSections(savedDefaults));
          setExpandedSection(null);
        } else {
          const hydrated = normalizeSections(storedSections);
          setSections(hydrated);
          setSnapshot(cloneSections(hydrated));
          setExpandedSection(null);
        }
      } catch (loadError) {
        console.error(loadError);
        toast({
          title: "Unable to load",
          description: "We could not load your Code of Conduct. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsRemoteLoading(false);
      }
    };

    loadSections();
  }, [authLoading, user, toast, persistSections]);

  const handleFieldChange = (sectionId: string, rowIndex: number, field: keyof OffenceRow, value: string) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const updatedOffences = section.offences.map((offence, idx) => {
          if (idx !== rowIndex) return offence;
          return { ...offence, [field]: value };
        });
        return { ...section, offences: updatedOffences };
      }),
    );
  };

  const handleAddOffence = (sectionId: string) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          offences: [
            ...section.offences,
            {
              name: "",
              first: "",
            },
          ],
        };
      }),
    );
  };

  const handleAddFourthOutcome = (sectionId: string, rowIndex: number) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const updated = section.offences.map((offence, idx) => {
          if (idx !== rowIndex) return offence;
          return { ...offence, fourth: offence.fourth ?? "" };
        });
        return { ...section, offences: updated };
      }),
    );
  };

  const handleDeleteOffence = async (sectionId: string, rowIndex: number) => {
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;

    const removedRow = section.offences[rowIndex];
    if (!removedRow) return;

    startUndoTimer({ kind: "offence", sectionId, row: { ...removedRow }, index: rowIndex });

    const updatedSections = sections.map((item) => {
      if (item.id !== sectionId) return item;
      return {
        ...item,
        offences: item.offences.filter((_, idx) => idx !== rowIndex),
      };
    });

    setSections(updatedSections);

    try {
      const savedSections = await persistSections(updatedSections);
      setSections(savedSections);
      setSnapshot(cloneSections(savedSections));
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to delete",
        description: "We couldn't save your changes. Please try again.",
        variant: "destructive",
      });
    }
  };


  const confirmDeleteOffence = (sectionId: string, rowIndex: number) => {
    const section = sections.find((item) => item.id === sectionId);
    const offenceName = section?.offences[rowIndex]?.name?.trim();
    const label = offenceName ? `"${offenceName}"` : "this offence";
    if (window.confirm(`Are you sure you want to delete ${label}?`)) {
      handleDeleteOffence(sectionId, rowIndex);
    }
  };

  const handleToggleEdit = () => {
    if (isRemoteLoading) return;
    if (isEditing) {
      if (snapshot) {
        setSections(cloneSections(snapshot));
      }
      setSnapshot(null);
      setIsEditing(false);
      clearUndoState();
    } else {
      setSnapshot(cloneSections(sections));
      setIsEditing(true);
    }
  };

  const handleSaveDraft = async () => {
    const invalidRows: string[] = [];
    sections.forEach((section) => {
      section.offences.forEach((offence) => {
        if (!offence.name.trim() || !offence.first.trim()) {
          invalidRows.push(section.title);
        }
      });
    });

    if (invalidRows.length > 0) {
      toast({
        title: "Missing information",
        description: "Each offence needs a name and at least the first outcome.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const savedSections = await persistSections(sections);
      setSections(savedSections);
      setSnapshot(cloneSections(savedSections));
      setIsEditing(false);
      clearUndoState();
      toast({
        title: "Saved",
        description: "Your Code of Conduct has been updated for this company.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to save",
        description: "We couldn't save your changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const clearUndoState = useCallback(() => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    if (undoIntervalRef.current) {
      clearInterval(undoIntervalRef.current);
      undoIntervalRef.current = null;
    }
    setUndoState(null);
    setUndoCountdown(0);
  }, []);

  const startUndoTimer = useCallback((action: OffenceUndoPayload) => {
    clearUndoState();
    const expiresAt = Date.now() + 30_000;
    setUndoState({ ...action, expiresAt });
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setUndoCountdown(remaining);
      if (remaining <= 0) {
        clearUndoState();
      }
    };
    updateCountdown();
    undoTimeoutRef.current = setTimeout(clearUndoState, 30_000);
    undoIntervalRef.current = setInterval(updateCountdown, 1_000);
  }, [clearUndoState]);

  useEffect(() => {
    return () => {
      clearUndoState();
    };
  }, [clearUndoState]);

  if ((authLoading || isRemoteLoading) && sections.length === 0) {
    return (
      <DashboardLayout>
        <style>{printStyles}</style>
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
          Loading your Code of Conduct...
        </div>
      </DashboardLayout>
    );
  }

  const handleUndoDelete = () => {
    if (!undoState) return;
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== undoState.sectionId) return section;
        const offences = [...section.offences];
        offences.splice(undoState.index, 0, { ...undoState.row });
        return { ...section, offences };
      }),
    );
    clearUndoState();
    toast({
      title: "Action restored",
      description: "The previous deletion has been undone.",
    });
  };

  const handleSaveRow = async (sectionId: string, rowIndex: number) => {
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;
    const offence = section.offences[rowIndex];
    if (!offence || !offence.name.trim() || !offence.first.trim()) {
      toast({
        title: "Missing information",
        description: "Offence name and first outcome are required before saving.",
        variant: "destructive",
      });
      return;
    }
    try {
      const savedSections = await persistSections(sections);
      setSections(savedSections);
      setSnapshot(cloneSections(savedSections));
      toast({
        title: "Row saved",
        description: `"${offence.name || "Untitled"}" saved to your company settings.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to save",
        description: "We couldn't save this offence. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <style>{printStyles}</style>
      {undoState && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-sm font-medium text-blue-900 shadow-lg shadow-red-100 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <button
              type="button"
              className="flex items-center gap-2 text-blue-900"
              onClick={handleUndoDelete}
            >
              Undo Delete
              <span className="text-xs text-blue-600">{undoCountdown}s</span>
            </button>
            <button
              type="button"
              className="text-blue-700 transition hover:text-blue-900"
              aria-label="Dismiss undo notification"
              onClick={clearUndoState}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div id="code-of-conduct-preview" className="mx-auto max-w-6xl px-6 py-6 md:py-8 space-y-6 print:space-y-4">
        <div className="sticky top-0 z-20 space-y-4 pb-4 pt-1">
          <div className="rounded-3xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Discipline</p>
                <h1 className="text-3xl font-bold text-gray-900">Code of Conduct</h1>
                <p className="text-base text-gray-600">
                  Track minor, serious, and dismissible misconduct with their progressive discipline outcomes.
                </p>
              </div>
              <div className="flex flex-col gap-2 md:w-auto md:flex-row md:items-center no-print">
                <Button variant="outline" className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-500 hover:text-white" asChild>
                  <Link to="/documents/discipline">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleToggleEdit}
                  className={cn(
                    "gap-2 border-blue-600 text-blue-600 hover:bg-blue-500 hover:text-white",
                    isEditing && "bg-blue-600 text-white hover:bg-blue-500",
                  )}
                >
                  <Edit2 className="h-4 w-4" />
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
                {isEditing && (
                  <Button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                    className="gap-2 bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-4 sm:p-6 space-y-4 print:max-h-none print:overflow-visible">
            <Accordion
              type="single"
              collapsible
              value={expandedSection ?? undefined}
              onValueChange={(value) => setExpandedSection(value || null)}
              className="space-y-4"
            >
              {sections.map((section) => (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="rounded-2xl border border-gray-200 bg-white px-4 print-section data-[state=open]:border-blue-300 data-[state=open]:shadow-sm"
                >
                  <AccordionTrigger className="flex w-full items-center gap-4 py-4 text-left text-gray-900 hover:no-underline hover:text-blue-600 data-[state=open]:text-blue-600">
                    <div className="flex flex-1 items-center gap-3">
                      <span className="text-lg font-semibold">{section.title}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                        {section.offences.length}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 space-y-4">
                <div className="hidden md:flex md:items-center md:justify-between md:pb-2">
                  <div className="grid flex-1 grid-cols-5 gap-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {gridColumns.map((column, index) => {
                      return (
                        <div
                          key={column.key}
                          className={cn(
                            "flex flex-col gap-1 md:-ml-px",
                            isEditing && index === 0 && "md:pl-[15px]",
                            isEditing && column.key === "first" && "md:pl-3",
                            isEditing && column.key === "second" && "md:pl-2",
                            isEditing && column.key === "third" && "md:-ml-1",
                            isEditing && column.key === "fourth" && "md:-ml-[10px]",
                          )}
                        >
                          <span>
                            {column.label}
                            {column.key === "fourth" && (
                              <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {isEditing && <div className="w-16" aria-hidden="true" />}
                </div>
                <div className="space-y-3">
                  {section.offences.map((offence, index) => (
                    <div
                      key={`${section.id}-${index}`}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-150 ease-out hover:border-blue-200 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="grid flex-1 gap-3 md:grid-cols-5">
                          {gridColumns.map((column) => {
                            if (column.key === "fourth" && offence.fourth === undefined && !isEditing) {
                              return (
                                <div key={`${section.id}-${index}-fourth`} className="flex flex-col gap-1">
                                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500 md:hidden">
                                    4th
                                  </span>
                                  <p className="text-sm text-gray-700">--</p>
                                </div>
                              );
                            }

                            return (
                          <div key={`${section.id}-${index}-${column.key}`} className="flex flex-col gap-1 md:-ml-px">
                                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 md:hidden">
                                  {column.label}
                                </span>
                                {column.key === "name" ? (
                                  isEditing ? (
                                    <Input
                                      value={offence.name}
                                      onChange={(event) =>
                                        handleFieldChange(section.id, index, "name", event.target.value)
                                      }
                                      placeholder={column.placeholder}
                                      className="border-blue-100 focus-visible:ring-blue-600"
                                    />
                                  ) : (
                                    <p className="text-sm font-medium text-gray-900">{offence.name}</p>
                                  )
                                ) : isEditing ? (
                                  column.key !== "fourth" || offence.fourth !== undefined ? (
                                    <select
                                      value={offence[column.key] ?? ""}
                                      onChange={(event) =>
                                        handleFieldChange(section.id, index, column.key, event.target.value)
                                      }
                                      className="h-10 w-full rounded-md border border-blue-100 bg-white px-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                                    >
                                      <option value="">Not set</option>
                                      {actionOptions.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="justify-start border border-blue-200 px-3 text-blue-600 hover:border-2 hover:border-blue-500 hover:bg-white hover:text-blue-700"
                                      onClick={() => handleAddFourthOutcome(section.id, index)}
                                    >
                                      <Plus className="mr-1 h-4 w-4" />
                                      Add 4th offence
                                    </Button>
                                  )
                                ) : (
                                  <p className="text-sm text-gray-700">{offence[column.key] || "--"}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {isEditing && (
                          <div className="flex items-center justify-end gap-2 pr-1 md:w-16">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="border border-transparent text-red-600 transition hover:border-red-300 hover:bg-white hover:text-red-600"
                              onClick={() => confirmDeleteOffence(section.id, index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {isEditing && (
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
                      onClick={() => handleAddOffence(section.id)}
                    >
                      <Plus className="h-4 w-4" />
                      Add offence
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 md:flex-row md:items-center md:justify-start no-print">
          <Button variant="outline" className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-500 hover:text-white" asChild>
            <Link to="/documents/discipline">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
