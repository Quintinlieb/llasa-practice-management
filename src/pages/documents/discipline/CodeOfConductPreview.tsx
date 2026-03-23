import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Upload, Plus, Loader2, Trash2, X } from "lucide-react";
import jsPDF from "jspdf";

type OffenceCategory = "Minor" | "Serious" | "Dismissible";

type OffenceRow = {
  category: OffenceCategory;
  name: string;
  first?: string;
  second?: string;
  third?: string;
  fourth?: string;
  isDefault?: boolean;
};

type FixedCategoryId = "minor" | "serious" | "dismissible";

type OffenceSection = {
  id: FixedCategoryId;
  title: string;
  offences: OffenceRow[];
};

const fixedCategoryOrder: FixedCategoryId[] = ["minor", "serious", "dismissible"];

const categoryMetadata: Record<FixedCategoryId, { title: string; category: OffenceCategory }> = {
  minor: { title: "Minor Offences", category: "Minor" },
  serious: { title: "Serious Offences", category: "Serious" },
  dismissible: { title: "Dismissible Offences", category: "Dismissible" },
};

const misconductColorClasses = (category: OffenceCategory) => {
  if (category === "Minor") return "text-emerald-700";
  if (category === "Serious") return "text-amber-700";
  return "text-red-700";
};

const misconductBadgeClasses = (category: OffenceCategory) => {
  if (category === "Minor") return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (category === "Serious") return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-red-50 text-red-700 border border-red-200";
};

const defaultOffences: Record<FixedCategoryId, OffenceRow[]> = {
  minor: [
    {
      category: "Minor",
      name: "Unauthorised absenteeism",
      first: "First Written Warning",
      second: "Second Written Warning",
      third: "Final Written Warning",
      fourth: "Dismissal",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Arriving late for work",
      first: "First Written Warning",
      second: "Second Written Warning",
      third: "Final Written Warning",
      fourth: "Dismissal",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Leaving work early",
      first: "First Written Warning",
      second: "Second Written Warning",
      third: "Final Written Warning",
      fourth: "Dismissal",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Failure to report absence",
      first: "First Written Warning",
      second: "Second Written Warning",
      third: "Final Written Warning",
      fourth: "Dismissal",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Failure to report late arrival",
      first: "First Written Warning",
      second: "Second Written Warning",
      third: "Final Written Warning",
      fourth: "Dismissal",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Failure to report leaving early",
      first: "First Written Warning",
      second: "Second Written Warning",
      third: "Final Written Warning",
      fourth: "Dismissal",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Sleeping on duty",
      first: "First Written Warning",
      second: "Final Written Warning",
      third: "Dismissal",
      fourth: "",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Failure to clock in/out",
      first: "First Written Warning",
      second: "Second Written Warning",
      third: "Final Written Warning",
      fourth: "Dismissal",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Poor housekeeping",
      first: "First Written Warning",
      second: "Final Written Warning",
      third: "Dismissal",
      fourth: "",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Horseplay",
      first: "First Written Warning",
      second: "Second Written Warning",
      third: "Final Written Warning",
      fourth: "Dismissal",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Unauthorised use of cell phone",
      first: "First Written Warning",
      second: "Second Written Warning",
      third: "Final Written Warning",
      fourth: "Dismissal",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Breach of Policy or Procedure",
      first: "First Written Warning",
      second: "Final Written Warning",
      third: "Dismissal",
      fourth: "",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Breach of Rules or Regulations",
      first: "First Written Warning",
      second: "Final Written Warning",
      third: "Dismissal",
      fourth: "",
      isDefault: true,
    },
    {
      category: "Minor",
      name: "Failure to carry out instructions",
      first: "First Written Warning",
      second: "Final Written Warning",
      third: "Dismissal",
      fourth: "",
      isDefault: true,
    },
  ],
  serious: [
    {
      category: "Serious",
      name: "Negligence",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Unauthorised absenteeism > 5 days",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Refusal to work overtime",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Consistent poor time keeping",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Causing inharmonious relationships",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Unbecoming behaviour",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Insolence / Disrespectful behaviour",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Aggressive behaviour",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Insubordination / Refusing instructions",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Refusal to comply with policy/procedure",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Refusal to comply with rule",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Damage to company name",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Unauthorised wastage of materials",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Unauthorised removal",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Unauthorised possession",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Breach of OHS standards / policies",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Private work during working hours",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Unauthorised disclosure of information",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Misappropriation of property / funds",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Testing positive for alcohol",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Testing positive for illegal drugs",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Under the influence of alcohol/drugs",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Possession of alcohol/drugs on duty",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Unauthorised possession of firearm on duty",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Intimidation",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Incitement",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Illegal strike / picketing",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Viewing pornographic material on duty",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Unauthorised access",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Unauthorised use of company property",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Unauthorised use of client property",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Abusive language",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Dishonesty",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Gambling on duty",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
    {
      category: "Serious",
      name: "Clocking for another employee",
      first: "Final Written Warning",
      second: "Dismissal",
      isDefault: true,
    },
  ],
  dismissible: [
    { category: "Dismissible", name: "Theft", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Accomplice to theft", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Fraud", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Accomplice to fraud", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Gross dishonesty", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Gross negligence", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Assault", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Sexual harassment", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Viewing illegal pornography on duty", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Racism", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Refusal to obey OHS rules/procedures", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Bribery", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Falsification of records", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Intentional damage to property", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Gross insubordination", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Unauthorised discharge of firearm", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Unsafe use of firearm", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Threatening another employee/client", first: "Dismissal", isDefault: true },
    { category: "Dismissible", name: "Unauthorised possession of a weapon on duty", first: "Dismissal", isDefault: true },
  ],
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
    title: categoryMetadata[id].title,
    offences: defaultOffences[id].map((offence) => ({ ...offence })),
  }));

const formatCompanyDisplayName = (companyName?: string | null, companyType?: string | null) => {
  const name = (companyName || "").trim();
  const type = (companyType || "").trim();
  if (!name && !type) return "";
  if (!name) return type;
  if (!type) return name;
  if (name.toLowerCase().includes(type.toLowerCase())) return name;
  return `${name} ${type}`;
};

const initialSections: OffenceSection[] = createFixedSections();

const resolveCategoryId = (section: Partial<OffenceSection>): FixedCategoryId | null => {
  if (section.id && fixedCategoryOrder.includes(section.id)) {
    return section.id;
  }
  const normalizedTitle = (section.title ?? "").trim().toLowerCase();
  const found = fixedCategoryOrder.find(
    (categoryId) => categoryMetadata[categoryId].title.trim().toLowerCase() === normalizedTitle,
  );
  return found ?? null;
};

const normalizeSections = (value?: OffenceSection[] | null): OffenceSection[] => {
  const defaults = createFixedSections();
  if (!value || value.length === 0) {
    return defaults;
  }

  const lookup = defaults.reduce<Record<FixedCategoryId, OffenceSection>>((acc, section) => {
    acc[section.id] = { ...section, offences: section.offences.map((offence) => ({ ...offence })) };
    return acc;
  }, {} as Record<FixedCategoryId, OffenceSection>);

  value.forEach((section) => {
    const categoryId = resolveCategoryId(section);
    if (!categoryId) return;

    const existingSection = lookup[categoryId];
    const defaultNames = new Set(
      defaultOffences[categoryId].map((offence) => offence.name.trim().toLowerCase()),
    );

    (section.offences ?? []).forEach((offence) => {
      const name = offence.name ?? "";
      const normalizedName = name.trim().toLowerCase();
      const isDefault = offence.isDefault === true || defaultNames.has(normalizedName);

      if (isDefault) {
        return;
      }

      existingSection.offences.push({
        category: categoryMetadata[categoryId].category,
        name,
        first: offence.first ?? "",
        second: offence.second ?? "",
        third: offence.third ?? "",
        fourth: offence.fourth === undefined ? undefined : offence.fourth ?? "",
        isDefault: false,
      });
    });
  });

  return fixedCategoryOrder.map((id) => ({
    ...lookup[id],
    offences: lookup[id].offences.map((offence) => ({ ...offence })),
  }));
};

const gridColumns = [
  { key: "name", label: "Misconduct", placeholder: "e.g. Arriving late for work" },
  { key: "first", label: "1st Offence", placeholder: "Outcome for 1st offence" },
  { key: "second", label: "2nd Offence", placeholder: "Outcome for 2nd offence" },
  { key: "third", label: "3rd Offence", placeholder: "Outcome for 3rd offence" },
  { key: "fourth", label: "4th Offence", placeholder: "Outcome for 4th offence" },
] as const;

export default function CodeOfConductPreviewPage({
  embedded = false,
  onStepChange,
  onStepMetaChange,
}: {
  embedded?: boolean;
  onStepChange?: (step: string | null) => void;
  onStepMetaChange?: (meta: {
    steps: readonly string[];
    activeStep: number;
    icons?: readonly ComponentType<SVGProps<SVGSVGElement>>[];
    canGoNext?: boolean;
    canGoBack?: boolean;
    onNext?: () => void;
    onBack?: () => void;
  }) => void;
}) {
  const { user, loading: authLoading } = useAuth();
  const [sections, setSections] = useState<OffenceSection[]>([]);
  const [snapshot, setSnapshot] = useState<OffenceSection[] | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<FixedCategoryId>("minor");
  const [isRemoteLoading, setIsRemoteLoading] = useState(true);
  const [undoState, setUndoState] = useState<UndoAction | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  const [tableOffsetTop, setTableOffsetTop] = useState(0);
  const { toast } = useToast();
  const selectedSection = useMemo(
    () => sections.find((section) => section.id === activeCategoryId) ?? null,
    [sections, activeCategoryId],
  );

  useEffect(() => {
    if (!embedded) return;
    onStepChange?.(null);
  }, [embedded, onStepChange]);

  useEffect(() => {
    if (!embedded) return;
    onStepMetaChange?.({
      steps: ["Code of Conduct"],
      activeStep: 0,
      canGoNext: false,
      canGoBack: false,
    });
  }, [embedded, onStepMetaChange]);

  useLayoutEffect(() => {
    const updateOffset = () => {
      if (!tableCardRef.current) return;
      const rect = tableCardRef.current.getBoundingClientRect();
      setTableOffsetTop(rect.top);
    };

    updateOffset();
    const onResize = () => requestAnimationFrame(updateOffset);
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [activeCategoryId, sections.length, isEditing]);

  const tableBottomGap = 32;
  const tableFooterHeight = 32;
  const tableMaxHeight =
    tableOffsetTop > 0
      ? `calc(100vh - ${tableOffsetTop}px - ${tableBottomGap + tableFooterHeight}px)`
      : `calc(100vh - ${380 + tableBottomGap + tableFooterHeight}px)`;
  const tableBodyMaxHeight =
    tableOffsetTop > 0
      ? `calc(100vh - ${tableOffsetTop}px - ${tableBottomGap + tableFooterHeight + 56}px)`
      : `calc(100vh - ${380 + tableBottomGap + tableFooterHeight + 56}px)`;

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
        } else {
          const hydrated = normalizeSections(storedSections);
          setSections(hydrated);
          setSnapshot(cloneSections(hydrated));
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

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      return;
    }

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        console.warn("Unable to load company profile", error);
        return;
      }
      setProfile(data ?? null);
    };

    loadProfile();
  }, [authLoading, user]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) {
      setShowScrollHint(false);
      return;
    }

    const updateHint = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 1;
      const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 1;
      setShowScrollHint(canScroll && !atBottom);
    };

    updateHint();
    el.addEventListener("scroll", updateHint);
    window.addEventListener("resize", updateHint);

    return () => {
      el.removeEventListener("scroll", updateHint);
      window.removeEventListener("resize", updateHint);
    };
  }, [selectedSection?.offences.length, isEditing]);

  const handleFieldChange = (sectionId: string, rowIndex: number, field: keyof OffenceRow, value: string) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const updatedOffences = section.offences.map((offence, idx) => {
          if (idx !== rowIndex || offence.isDefault) return offence;
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
              category: categoryMetadata[section.id].category,
              name: "",
              first: "",
              isDefault: false,
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
          if (idx !== rowIndex || offence.isDefault) return offence;
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
    if (!removedRow || removedRow.isDefault) {
      toast({
        title: "Protected offence",
        description: "Default offences cannot be deleted.",
        variant: "destructive",
      });
      return;
    }

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
    if (section?.offences[rowIndex]?.isDefault) {
      toast({
        title: "Protected offence",
        description: "Default offences cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
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
        const hasName = offence.name?.trim();
        const hasFirstOutcome = offence.first?.trim();
        if (!hasName || !hasFirstOutcome) {
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

  const handleExportPdf = () => {
    if (sections.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No offences available to export.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const footerHeight = 20;
      const contentBottom = pageHeight - footerHeight - 3;
      const disclaimerPrefix = "Disclaimer:";
      const disclaimerText =
        "This Code of Conduct serves as a guideline only and does not constitute a binding tariff of sanctions. The Employer retains full discretion to determine appropriate disciplinary action based on the specific circumstances of each case, including the nature and seriousness of the misconduct and any relevant mitigating or aggravating factors, and may deviate from the suggested sanctions where justified, subject always to the requirements of fairness in terms of applicable labour legislation.";
      const companyName = formatCompanyDisplayName(profile?.company_name, profile?.company_type) || "Company";
      const footerTopRowLeft = companyName;
      const footerTopRowCenter = "This document is confidential and for internal use only.";
      const firstPageTopContentY = 22;
      const continuationTopContentY = 12;
      let y = firstPageTopContentY;

      const columns = [
        { key: "name", label: "Misconduct", width: 85 },
        { key: "first", label: "1st Offence", width: 47 },
        { key: "second", label: "2nd Offence", width: 47 },
        { key: "third", label: "3rd Offence", width: 47 },
        { key: "fourth", label: "4th Offence", width: 47 },
      ] as const;

      const drawPageHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text("Code of Conduct", pageWidth / 2, 11, { align: "center" });
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, 14.5, margin + contentWidth, 14.5);
      };

      const drawSectionHeader = (title: string) => {
        const sectionHeaderHeight = 7;
        doc.setFillColor(51, 65, 85);
        doc.setDrawColor(51, 65, 85);
        doc.setLineWidth(0.16);
        doc.rect(margin, y, contentWidth, sectionHeaderHeight, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(title, margin + 3, y + 4.8);
        y += sectionHeaderHeight + 1.8;
      };

      const drawTableHeader = () => {
        const headerHeight = 7;
        let x = margin;
        columns.forEach((col) => {
          doc.setFillColor(241, 245, 249);
          doc.rect(x, y, col.width, headerHeight, "F");
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.15);
          doc.rect(x, y, col.width, headerHeight, "S");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          doc.text(col.label, x + 2, y + 4.6);
          x += col.width;
        });
        y += headerHeight;
      };

      const startNewPage = () => {
        doc.addPage();
        y = continuationTopContentY;
      };

      const ensureSpace = (height: number) => {
        if (y + height > contentBottom) {
          startNewPage();
        }
      };

      drawPageHeader();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      const disclaimerLineHeight = 3.8;
      const prefixWithSpace = `${disclaimerPrefix} `;
      doc.setFont("helvetica", "bold");
      const prefixWidth = doc.getTextWidth(prefixWithSpace);
      doc.setFont("helvetica", "normal");

      const drawJustifiedLine = (text: string, x: number, yPos: number, width: number, isLastLine: boolean) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (isLastLine || !trimmed.includes(" ")) {
          doc.text(trimmed, x, yPos);
          return;
        }
        const words = trimmed.split(/\s+/);
        const wordsWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0);
        const gaps = Math.max(words.length - 1, 1);
        const gapWidth = (width - wordsWidth) / gaps;
        let cursorX = x;
        words.forEach((word, idx) => {
          doc.text(word, cursorX, yPos);
          cursorX += doc.getTextWidth(word);
          if (idx < words.length - 1) {
            cursorX += gapWidth;
          }
        });
      };

      const bodyWords = disclaimerText.split(/\s+/).filter(Boolean);
      const firstLineWidth = Math.max(contentWidth - prefixWidth, 20);
      const wrappedBodyLines: string[] = [];
      let currentLine = "";
      let currentMaxWidth = firstLineWidth;

      bodyWords.forEach((word) => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (!currentLine || doc.getTextWidth(candidate) <= currentMaxWidth) {
          currentLine = candidate;
          return;
        }
        wrappedBodyLines.push(currentLine);
        currentLine = word;
        currentMaxWidth = contentWidth;
      });
      if (currentLine) {
        wrappedBodyLines.push(currentLine);
      }
      if (wrappedBodyLines.length === 0) {
        wrappedBodyLines.push("");
      }

      const disclaimerHeight = wrappedBodyLines.length * disclaimerLineHeight + 2;
      ensureSpace(disclaimerHeight);

      const firstLineY = y + 2.5;
      doc.setFont("helvetica", "bold");
      doc.text(prefixWithSpace, margin, firstLineY);
      doc.setFont("helvetica", "normal");
      drawJustifiedLine(
        wrappedBodyLines[0] ?? "",
        margin + prefixWidth,
        firstLineY,
        firstLineWidth,
        wrappedBodyLines.length === 1,
      );

      for (let lineIndex = 1; lineIndex < wrappedBodyLines.length; lineIndex += 1) {
        const lineY = firstLineY + lineIndex * disclaimerLineHeight;
        const isLast = lineIndex === wrappedBodyLines.length - 1;
        drawJustifiedLine(wrappedBodyLines[lineIndex] ?? "", margin, lineY, contentWidth, isLast);
      }

      y += disclaimerHeight + 1.5;

      fixedCategoryOrder.forEach((categoryId, sectionIndex) => {
        const section = sections.find((item) => item.id === categoryId);
        if (!section) return;

        ensureSpace(16);
        drawSectionHeader(categoryMetadata[categoryId].title);
        drawTableHeader();

        section.offences.forEach((offence) => {
          const rowValues = [
            offence.name || "-",
            offence.first || "-",
            offence.second || "-",
            offence.third || "-",
            offence.fourth || "-",
          ];
          const lineHeight = 3.6;
          const cellPaddingX = 2;
          const cellPaddingY = 2;
          const cellLines = columns.map((col, idx) =>
            doc.splitTextToSize(rowValues[idx], col.width - cellPaddingX * 2),
          );
          const maxLines = Math.max(...cellLines.map((lines) => Math.max(lines.length, 1)));
          const rowHeight = maxLines * lineHeight + cellPaddingY * 2;

          if (y + rowHeight > contentBottom) {
            startNewPage();
            drawTableHeader();
          }

          let x = margin;
          columns.forEach((col, idx) => {
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.12);
            doc.rect(x, y, col.width, rowHeight);
            doc.setFont("helvetica", idx === 0 ? "bold" : "normal");
            doc.setFontSize(8);
            doc.setTextColor(17, 24, 39);
            const lines = cellLines[idx];
            lines.forEach((line: string, lineIdx: number) => {
              doc.text(line, x + cellPaddingX, y + cellPaddingY + 2.8 + lineIdx * lineHeight);
            });
            x += col.width;
          });

          y += rowHeight;
        });

        if (sectionIndex < fixedCategoryOrder.length - 1) {
          y += 3.5;
        }
      });

      const totalPages = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber);
        const footerTop = pageHeight - footerHeight;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, footerTop, margin + contentWidth, footerTop);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(70, 74, 78);
        doc.text(footerTopRowLeft, margin, footerTop + 6.2, { align: "left" });
        doc.text(footerTopRowCenter, pageWidth / 2, footerTop + 6.2, { align: "center" });
        doc.text(`Page ${pageNumber} of ${totalPages}`, margin + contentWidth, footerTop + 6.2, { align: "right" });
      }

      doc.setTextColor(0, 0, 0);

      doc.save("Code_of_Conduct.pdf");
      toast({
        title: "Export ready",
        description: "Code of Conduct exported successfully.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Export failed",
        description: "Unable to export Code of Conduct right now.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
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
    const loadingContent = (
      <>
        <style>{printStyles}</style>
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
          Loading your Code of Conduct...
        </div>
      </>
    );
    return embedded ? loadingContent : <DashboardLayout>{loadingContent}</DashboardLayout>;
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
    const hasName = offence?.name?.trim();
    const hasFirstOutcome = offence?.first?.trim();
    if (!offence || !hasName || !hasFirstOutcome) {
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

  const content = (
    <>
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
      <div
        id="code-of-conduct-preview"
        className={cn(
          "space-y-3 print:space-y-4",
          embedded ? "px-0 pt-4 pr-4 pb-4" : "-ml-6 -mr-6 pl-3 pr-3 -mt-3",
        )}
      >
        <div className="space-y-4">
          {!embedded && (
            <p className="text-xs font-semibold text-slate-700">
              Documents / Discipline /{" "}
              <span className="text-blue-700 underline underline-offset-4">Code of Conduct</span>
            </p>
          )}
          <div className="rounded-sm border border-slate-300 bg-white shadow-sm">
            <div className="p-4 sm:p-6 space-y-4 print:max-h-none print:overflow-visible">
            <Tabs
              value={activeCategoryId}
              onValueChange={(value) => setActiveCategoryId(value as FixedCategoryId)}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200">
                <TabsList className="h-auto flex-1 flex-wrap justify-start gap-0 bg-transparent px-0 py-0 shadow-none">
                  {fixedCategoryOrder.map((id) => (
                    <TabsTrigger
                      key={id}
                      value={id}
                      className="rounded-none border-b-[3px] border-transparent px-5 py-1 text-left text-sm font-medium text-slate-500 data-[state=inactive]:hover:text-slate-800 data-[state=active]:bg-white data-[state=active]:border-blue-600 data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
                    >
                      {categoryMetadata[id].title.replace(" Offences", "")}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportPdf}
                  disabled={isExporting || sections.length === 0}
                  className="mb-1 h-8 w-24 rounded px-3 text-[11px] inline-flex items-center justify-center gap-1 border border-slate-200 bg-white text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-600 disabled:text-slate-300"
                >
                  {isExporting ? <Upload className="h-3.5 w-3.5 animate-pulse" /> : <Upload className="h-3.5 w-3.5" />}
                  {isExporting ? "Exporting" : "Export"}
                </Button>
              </div>
              {selectedSection && (
                <div className="rounded-sm bg-white px-0 print-section">
                  <div className="pb-2 space-y-2">
                    <div
                      ref={tableCardRef}
                      className="relative overflow-hidden"
                      style={{ maxHeight: tableMaxHeight }}
                    >
                      <div
                        className={cn(
                          "grid items-center gap-2 border-b bg-transparent px-3 py-3 text-xs font-semibold text-muted-foreground underline underline-offset-4",
                          isEditing
                            ? "grid-cols-[2fr_1.25fr_1.25fr_1.25fr_1.25fr_3rem]"
                            : "grid-cols-[2fr_1.25fr_1.25fr_1.25fr_1.25fr]",
                        )}
                      >
                        {gridColumns.map((column) => (
                          <div
                            key={column.key}
                            className={cn(
                              "flex items-center leading-tight",
                              column.key !== "name" && "pl-6",
                            )}
                          >
                            {column.label}
                          </div>
                        ))}
                        {isEditing && <div className="flex items-center justify-center leading-tight">Actions</div>}
                      </div>
                      <div
                        ref={tableScrollRef}
                        className="divide-y employee-table-scroll overflow-y-auto"
                        style={{ maxHeight: tableBodyMaxHeight }}
                      >
                        {selectedSection.offences.map((offence, index) => (
                          <div
                            key={`${selectedSection.id}-${index}`}
                            className={cn(
                              "grid items-center gap-2 px-3 py-2.5 text-xs hover:bg-blue-50/70",
                              isEditing
                                ? "grid-cols-[2fr_1.25fr_1.25fr_1.25fr_1.25fr_3rem]"
                                : "grid-cols-[2fr_1.25fr_1.25fr_1.25fr_1.25fr]",
                            )}
                          >
                            {gridColumns.map((column) => {
                              const isDefaultRow = offence.isDefault === true;
                              const canEditRow = isEditing && !isDefaultRow;
                              const showFourthSelect =
                                column.key !== "fourth" || offence.fourth !== undefined || isDefaultRow;

                              return (
                                <div
                                  key={`${selectedSection.id}-${index}-${column.key}`}
                                  className={cn(
                                    "flex items-center leading-tight",
                                    column.key !== "name" && "pl-6",
                                  )}
                                >
                                  {column.key === "name" ? (
                                    isEditing ? (
                                      <Input
                                        value={offence.name}
                                        onChange={(event) =>
                                          handleFieldChange(selectedSection.id, index, "name", event.target.value)
                                        }
                                        placeholder={column.placeholder}
                                        className="h-10 rounded-sm border border-slate-200 bg-white px-2 text-xs font-medium text-slate-900 shadow-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-400"
                                        readOnly={!canEditRow}
                                        disabled={!canEditRow}
                                      />
                                    ) : (
                                      <span className="font-medium text-gray-900">{offence.name || "--"}</span>
                                    )
                                  ) : isEditing ? (
                                    showFourthSelect ? (
                                      <select
                                        value={offence[column.key] ?? ""}
                                        onChange={(event) =>
                                          handleFieldChange(selectedSection.id, index, column.key, event.target.value)
                                        }
                                        className="h-10 w-full rounded-sm border border-slate-200 bg-white px-2 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-400"
                                        disabled={!canEditRow}
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
                                        className="h-10 justify-start rounded-sm border border-blue-200 px-3 text-xs font-medium text-blue-700 hover:border-blue-500 hover:bg-white hover:text-blue-800"
                                        onClick={() => handleAddFourthOutcome(selectedSection.id, index)}
                                        disabled={!canEditRow}
                                      >
                                        <Plus className="mr-1 h-4 w-4" />
                                        Add 4th offence
                                      </Button>
                                    )
                                  ) : (
                                    <span className="text-gray-700">{offence[column.key] || "--"}</span>
                                  )}
                                </div>
                              );
                            })}
                            {isEditing && (
                              <div className="flex items-center justify-center">
                                {!offence.isDefault && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 border border-transparent text-red-600 transition hover:border-red-300 hover:bg-white hover:text-red-600"
                                    onClick={() => confirmDeleteOffence(selectedSection.id, index)}
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {showScrollHint && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                          <div className="relative rounded-sm border border-blue-100 bg-white/95 px-4 py-1 text-xs font-semibold text-blue-900 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                            <span
                              className="pointer-events-none absolute inset-0 rounded-sm shadow-[0_3px_10px_rgba(59,130,246,0.35),0_-3px_10px_rgba(59,130,246,0.2)]"
                              aria-hidden="true"
                            ></span>
                            <span className="relative">Scroll down</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {isEditing && (
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
                          onClick={() => handleAddOffence(selectedSection.id)}
                        >
                          <Plus className="h-4 w-4" />
                          Add offence
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Tabs>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
}
