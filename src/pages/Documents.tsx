import { Suspense, lazy, useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ScaleIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BellAlertIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { ArrowLeft, ArrowRight, Check, Menu, Undo2 } from "lucide-react";

type DocumentKey =
  | "codeOfConduct"
  | "warnings"
  | "disciplinaryHearingNotice"
  | "incapacityPerformanceHearingNotice"
  | "permanentContract"
  | "temporaryContract"
  | "addendum"
  | "noticeTermination"
  | "illHealthTermination"
  | "abscondmentTermination"
  | "retrenchmentTermination"
  | "retirementTermination"
  | "poorPerformanceTermination"
  | "mutualTermination";

type DocumentItem = {
  id?: DocumentKey;
  label: string;
  active: boolean;
};

type DocumentCategory = {
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  items: DocumentItem[];
};

type StoredProfile = {
  user_name?: string;
  user_surname?: string;
};

type DocumentComponentProps = {
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

const documentComponents: Record<DocumentKey, ComponentType<DocumentComponentProps>> = {
  codeOfConduct: lazy(() => import("./documents/discipline/CodeOfConductPreview")),
  warnings: lazy(() => import("./WarningGenerator")),
  disciplinaryHearingNotice: lazy(() => import("./DisciplinaryHearingNoticeGenerator")),
  incapacityPerformanceHearingNotice: lazy(() => import("./IncapacityPerformanceHearingNoticeGenerator")),
  permanentContract: lazy(() => import("./PermanentContractGenerator")),
  temporaryContract: lazy(() => import("./TemporaryContractGenerator")),
  addendum: lazy(() => import("./AddendumGenerator")),
  noticeTermination: lazy(() => import("./MisconductTerminationGenerator")),
  illHealthTermination: lazy(() => import("./IllHealthTerminationGenerator")),
  abscondmentTermination: lazy(() => import("./AbscondmentTerminationGenerator")),
  retrenchmentTermination: lazy(() => import("./RetrenchmentTerminationGenerator")),
  retirementTermination: lazy(() => import("./RetirementTerminationGenerator")),
  poorPerformanceTermination: lazy(() => import("./PoorPerformanceTerminationGenerator")),
  mutualTermination: lazy(() => import("./MutualTerminationGenerator")),
};

const documentCategories: DocumentCategory[] = [
  {
    title: "Discipline",
    icon: ScaleIcon,
    items: [
      { id: "codeOfConduct", label: "Code of Conduct", active: true },
      { id: "warnings", label: "Warnings", active: true },
    ],
  },
  {
    title: "Contracts",
    icon: DocumentTextIcon,
    items: [
      { id: "permanentContract", label: "Permanent Contract", active: true },
      { id: "temporaryContract", label: "Temporary Contract", active: true },
      { id: "addendum", label: "Addendum", active: true },
    ],
  },
  {
    title: "Terminations",
    icon: DocumentTextIcon,
    items: [
      { id: "noticeTermination", label: "Misconduct", active: true },
      { id: "illHealthTermination", label: "Ill Health", active: true },
      { id: "poorPerformanceTermination", label: "Poor Performance", active: true },
      { id: "abscondmentTermination", label: "Abscondment/Desertion", active: true },
      { id: "retrenchmentTermination", label: "Retrenchment", active: true },
      { id: "retirementTermination", label: "Retirement", active: true },
      { id: "mutualTermination", label: "Mutual Seperation Agreement", active: true },
    ],
  },
  {
    title: "Notices",
    icon: BellAlertIcon,
    items: [
      { id: "disciplinaryHearingNotice", label: "Disciplinary Hearing", active: true },
      { id: "incapacityPerformanceHearingNotice", label: "Incapacity Hearing (Performance)", active: true },
      { label: "Incapacity Hearing (Ill health)", active: false },
      { label: "Precautionary Suspension", active: false },
      { label: "Retrenchment Consultation (S189)", active: false },
    ],
  },
  {
    title: "Other",
    icon: ChartBarIcon,
    items: [
      { label: "Performance Appraisals", active: false },
      { label: "Counselling", active: false },
      { label: "Certificate of Service", active: false },
      { label: "Leave Request", active: false },
      { label: "Grievance", active: false },
      { label: "Offer of Employment", active: false },
      { label: "Interview Invitation", active: false },
      { label: "Objection to Con/Arb", active: false },
    ],
  },
];

const Documents = () => {
  const location = useLocation();
  const [openCategory, setOpenCategory] = useState<string>("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentKey | null>(null);
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [breadcrumbStep, setBreadcrumbStep] = useState<string | null>(null);
  const [modalDocument, setModalDocument] = useState<
    | "warnings"
    | "disciplinaryHearingNotice"
    | "incapacityPerformanceHearingNotice"
    | "addendum"
    | "permanentContract"
    | "temporaryContract"
    | "noticeTermination"
    | "illHealthTermination"
    | "abscondmentTermination"
    | "retrenchmentTermination"
    | "retirementTermination"
    | "poorPerformanceTermination"
    | "mutualTermination"
    | null
  >(null);
  const [stepMeta, setStepMeta] = useState<{
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
  } | null>(null);

  useEffect(() => {
    const nextSelected = (location.state as { selectedDocument?: DocumentKey } | null)?.selectedDocument;
    if (nextSelected && documentComponents[nextSelected]) {
      setSelectedDocument(nextSelected);
    }
  }, [location.state]);

  useEffect(() => {
    setBreadcrumbStep(null);
  }, [selectedDocument]);

  useEffect(() => {
    const readProfile = () => {
      try {
        const raw = sessionStorage.getItem("header:profile");
        return raw ? (JSON.parse(raw) as StoredProfile) : null;
      } catch {
        return null;
      }
    };

    const stored = readProfile();
    if (stored) {
      setProfile(stored);
      return;
    }

    const interval = setInterval(() => {
      const next = readProfile();
      if (next) {
        setProfile(next);
        clearInterval(interval);
      }
    }, 400);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    const checkScroll = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 4;
      const atTop = el.scrollTop <= 8;
      setShowScrollHint(canScroll && atTop);
    };
    checkScroll();
    const onScroll = () => checkScroll();
    el.addEventListener("scroll", onScroll);
    const onResize = () => checkScroll();
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [selectedDocument]);

  const SelectedComponent = selectedDocument ? documentComponents[selectedDocument] : null;
  const ModalComponent = modalDocument ? documentComponents[modalDocument] : null;
  const activeCategoryTitle =
    selectedDocument
      ? documentCategories.find((category) =>
          category.items.some((item) => item.id === selectedDocument),
        )?.title ?? ""
      : "";
  const breadcrumbCategoryTitle =
    selectedDocument === "noticeTermination" ||
    selectedDocument === "illHealthTermination" ||
    selectedDocument === "abscondmentTermination" ||
    selectedDocument === "retrenchmentTermination" ||
    selectedDocument === "retirementTermination" ||
    selectedDocument === "poorPerformanceTermination"
      ? "Termination Letter"
    : selectedDocument === "mutualTermination"
      ? "Terminations"
      : activeCategoryTitle;
  const activeDocumentLabel =
    selectedDocument
      ? documentCategories
          .flatMap((category) => category.items)
          .find((item) => item.id === selectedDocument)?.label ?? ""
      : "";
  const modalTitle =
    modalDocument === "warnings"
      ? "Warnings"
      : modalDocument === "disciplinaryHearingNotice"
        ? "Disciplinary Hearing"
      : modalDocument === "incapacityPerformanceHearingNotice"
        ? "Incapacity Hearing (Performance)"
      : modalDocument === "addendum"
        ? "Addendum"
        : modalDocument === "poorPerformanceTermination"
          ? "Poor Performance"
        : modalDocument === "illHealthTermination"
          ? "Ill Health"
        : modalDocument === "abscondmentTermination"
          ? "Abscondment/Desertion"
        : modalDocument === "retrenchmentTermination"
          ? "Retrenchment"
        : modalDocument === "retirementTermination"
          ? "Retirement"
        : modalDocument === "mutualTermination"
          ? "Mutual Seperation Agreement"
        : modalDocument === "noticeTermination"
          ? "Notice of Termination"
        : modalDocument === "permanentContract"
          ? "Permanent Contract"
          : modalDocument === "temporaryContract"
            ? "Temporary Contract"
          : "";
  const modalSteps =
    modalDocument === "warnings" ||
    modalDocument === "disciplinaryHearingNotice" ||
    modalDocument === "incapacityPerformanceHearingNotice" ||
    modalDocument === "addendum" ||
    modalDocument === "noticeTermination" ||
    modalDocument === "illHealthTermination" ||
    modalDocument === "abscondmentTermination" ||
    modalDocument === "retrenchmentTermination" ||
    modalDocument === "retirementTermination" ||
    modalDocument === "poorPerformanceTermination" ||
    modalDocument === "mutualTermination" ||
    modalDocument === "permanentContract" ||
    modalDocument === "temporaryContract"
      ? ([
          "Employer Details",
          "Employee Details",
          modalDocument === "warnings"
            ? "Warning Details"
              : modalDocument === "disciplinaryHearingNotice"
                ? "Notice Details"
              : modalDocument === "incapacityPerformanceHearingNotice"
                ? "Notice Details"
              : modalDocument === "addendum"
                ? "Addendum Details"
              : modalDocument === "noticeTermination" ||
                modalDocument === "illHealthTermination" ||
                modalDocument === "abscondmentTermination" ||
                modalDocument === "retrenchmentTermination" ||
                modalDocument === "retirementTermination" ||
                modalDocument === "poorPerformanceTermination" ||
                modalDocument === "mutualTermination"
                ? "Termination Details"
              : modalDocument === "temporaryContract"
                ? "Employment Details"
              : "Employment Details",
          modalDocument === "warnings" ? "Preview / Download" : "Preview / Edit",
        ] as const)
      : ([] as const);
  const modalActiveStep = stepMeta?.isFinished ? 3 : Math.min(stepMeta?.activeStep ?? 0, 2);
  const canSelectTrackerStep = (index: number) => {
    if (!stepMeta?.onStepSelect) return false;
    if (stepMeta.canSelectStep) return stepMeta.canSelectStep(index);
    const maxIndex = stepMeta.steps.length - 1;
    if (index < 0 || index > maxIndex) return false;
    return index < stepMeta.activeStep;
  };
  const handleTrackerStepSelect = (index: number) => {
    if (!canSelectTrackerStep(index)) return;
    stepMeta?.onStepSelect?.(index);
  };
  const activeModalStepLabel = modalSteps[modalActiveStep] ?? modalSteps[0] ?? "";
  const addendumStepNotes = [
    [
      "The company name, registration number, and address can be changed in Company Settings.",
      "If applicable, you may insert a trading name for your company. The contact number and email address are auto populated but can be changed by selecting the respective input fields.",
    ],
    [
      "You may either select from existing employees or enter employee details manually.",
      "If not done yet, head over to the employees page and add all your employees either by single employee add or multiple upload.",
    ],
    [
      "Choose one of the three addendum types and insert the applicable dates.",
      "A General Addendum is ordinarily used to amend specific terms of an existing employment contract, such as remuneration, working hours, position, or benefits.",
      "An extension is used where a current temporary contract is still active and the Parties agree to extend the existing end date.",
      "A renewal applies where a temporary contract has already expired and the Parties agree to enter into a new temporary period of employment.",
    ],
    [
      "Review and finalize the editable preview before downloading.",
      "The general addendum is a starting point, so add the specific amendments the parties agreed to for the existing contract.",
      "Use Edit to change clause text, Add to insert new clauses, and Delete (for custom clauses) to remove terms.",
      "Example:",
      "Salarry / Remuneration (Clause title)",
      "Clause 5 of the employment contract is hereby amended, with effect from 3 March 2026, and the salary is R25,000 per month. (Clause body)",
    ],
  ] as const;
  const permanentStepNotes = [
    [
      "The company name, registration number, and address can be changed in Company Settings.",
      "If applicable, you may insert a trading name for your company. The contact number and email address are auto populated but can be changed by selecting the respective input fields.",
    ],
    [
      "You may either select from existing employees or enter employee details manually.",
      "If not done yet, head over to the employees page and add all your employees either by single employee add or multiple upload.",
    ],
    [
      "Capture the employment details exactly as agreed between the Employer and Employee.",
      "Complete all required fields before moving to the preview and edit step.",
    ],
    [
      "Review and finalize the editable preview before downloading.",
      "Use Edit to change clause text, Add to insert new clauses, and Delete (for custom clauses) to remove terms.",
    ],
  ] as const;
  const temporaryStepNotes = [
    [
      "The company name, registration number, and address can be changed in Company Settings.",
      "If applicable, you may insert a trading name for your company. The contact number and email address are auto populated but can be changed by selecting the respective input fields.",
    ],
    [
      'Add a single or multiple employees by selecting the "Add employee" button and follow the easy prompts.',
      "Ensure each added employee has name, surname, ID/Passport, cell number and address.",
    ],
    [
      "Capture temporary employment details and confirm how the contract ends (specific date or on completion of project/scope).",
      "Complete all required fields before moving to preview and edit.",
    ],
    [
      "Review and finalize the editable preview before downloading.",
      "Use Edit to change clause text, Add to insert new clauses, and Delete (for custom clauses) to remove terms.",
    ],
  ] as const;
  const warningStepNotes = [
    [
      "The company name, registration number, and address can be changed in Company Settings.",
      "If applicable, you may insert a trading name for your company. The contact number and email address are auto populated but can be changed by selecting the respective input fields.",
    ],
    [
      "You may either select from existing employees or enter employee details manually.",
      "If not done yet, head over to the employees page and add all your employees either by single employee add or multiple upload.",
    ],
    [
      "Select one or more misconduct types, provide a detailed description, and choose the correct warning type.",
      "The warning validity period is populated from the selected warning type.",
    ],
    [
      "Review the warning preview and download once details are verified.",
      "Use Back to return to the form if any information must be corrected.",
    ],
  ] as const;
  const noticeTerminationStepNotes = [
    [
      "This step sets how your company details appear on the letterhead in the final document.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this letter if needed.",
      "If you upload a logo, choose the letterhead layout and colour theme carefully.",
    ],
    [
      "Select an employee from your saved list or capture the employee details manually.",
      "For the address portion of this form, city, province, and area code are required. Address line 1 and 2 are optional.",
    ],
    [
      "Complete all fields in this step carefully, as these selections determine how key parts of the termination letter are worded.",
      "Before moving to preview, confirm that each required field reflects the outcome you intend to communicate.",
      "If you are unsure what to select, hover over the info icon next to the field label for guidance.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all text carefully before downloading the final termination letter.",
      "NB! Issue the letter on the same day as the letter date. If it will only be issued later, update the letter date before finalizing.",
    ],
  ] as const;
  const disciplinaryHearingStepNotes = [
    [
      "This step controls how your company details appear on the disciplinary hearing notice.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this notice.",
      "If you upload a logo, choose the letterhead layout and colour theme that match your company style.",
    ],
    [
      "Select an employee from your saved list or capture employee details manually.",
      "For the address section, city, province, and area code are required. Address line 1 and 2 are optional.",
    ],
    [
      "Capture the notice date, hearing date, hearing time, hearing location, and the applicable misconduct type(s).",
      "Each selected misconduct type requires a charge description before you can continue.",
      "A proper charge description should answer when, what, and how.",
      "You can type the charge description manually or use Drafting Assistant to generate a draft and then review it.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all wording carefully before downloading the final disciplinary hearing notice.",
    ],
  ] as const;
  const incapacityPerformanceHearingStepNotes = [
    [
      "This step controls how your company details appear on the incapacity hearing notice.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this notice.",
      "If you upload a logo, choose the letterhead layout and colour theme that match your company style.",
    ],
    [
      "Select an employee from your saved list or capture employee details manually.",
      "For the address section, city, province, and area code are required. Address line 1 and 2 are optional.",
    ],
    [
      "Capture the notice date, hearing date, hearing time, hearing location, and the applicable performance concern type(s).",
      "Each selected performance concern type requires a concern description before you can continue.",
      "A proper concern description should answer where the employee did not meet required standards, with enough detail to prepare a response.",
      "Use an incapacity (poor performance) procedure for performance concerns. Do not treat poor performance as misconduct or follow a disciplinary misconduct process.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all wording carefully before downloading the final incapacity hearing notice.",
    ],
  ] as const;
  const addendumActiveNotes = addendumStepNotes[modalActiveStep] ?? addendumStepNotes[0];
  const permanentActiveNotes = permanentStepNotes[modalActiveStep] ?? permanentStepNotes[0];
  const warningActiveNotes = warningStepNotes[modalActiveStep] ?? warningStepNotes[0];
  const noticeTerminationActiveNotes =
    noticeTerminationStepNotes[modalActiveStep] ?? noticeTerminationStepNotes[0];
  const disciplinaryHearingActiveNotes =
    disciplinaryHearingStepNotes[modalActiveStep] ?? disciplinaryHearingStepNotes[0];
  const incapacityPerformanceHearingActiveNotes =
    incapacityPerformanceHearingStepNotes[modalActiveStep] ?? incapacityPerformanceHearingStepNotes[0];
  const mutualTerminationStepNotes = noticeTerminationStepNotes.map((notes, index) =>
    index === 0
      ? [
          "This step sets how your company details appear on the seperation agreement.",
          "Company name and registration number are populated from Company Settings. You can still add a trading name if applicable.",
        ]
    : index === 1
      ? [notes[0]]
    : index === 2
      ? [
          "Complete all fields in this step carefully, as these selections determine how key parts of the seperation agreement are worded.",
          ...notes.slice(1),
          "Generally, you should indicate the reason for termination on the UI19 form as Contract Ended.",
        ]
      : notes,
  );
  const mutualTerminationActiveNotes = (mutualTerminationStepNotes[modalActiveStep] ?? mutualTerminationStepNotes[0]).filter((note) => !note.startsWith("NB! "));
  const temporaryEmployeeCount = stepMeta?.temporaryEmployeeCount ?? 0;
  const temporaryActiveNotes = (() => {
    const baseNotes: string[] = [...(temporaryStepNotes[modalActiveStep] ?? temporaryStepNotes[0])];
    if (modalActiveStep === 2 && temporaryEmployeeCount > 1) {
      baseNotes.push(
        "The employment information selected and/or inserted in this step 3 will apply to all the employees. For example: Salary Amount will be the salary amount reflected on all the temporary contract of all the added employees at the previous step 2.",
      );
    }
    return baseNotes;
  })();
  const modalActiveNotes =
    modalDocument === "warnings"
      ? warningActiveNotes
      : modalDocument === "permanentContract"
      ? permanentActiveNotes
      : modalDocument === "disciplinaryHearingNotice"
      ? disciplinaryHearingActiveNotes
      : modalDocument === "incapacityPerformanceHearingNotice"
      ? incapacityPerformanceHearingActiveNotes
      : modalDocument === "noticeTermination" ||
        modalDocument === "illHealthTermination" ||
        modalDocument === "abscondmentTermination" ||
        modalDocument === "retrenchmentTermination" ||
        modalDocument === "retirementTermination" ||
        modalDocument === "poorPerformanceTermination" ||
        modalDocument === "mutualTermination"
        ? modalDocument === "mutualTermination"
          ? mutualTerminationActiveNotes
          : noticeTerminationActiveNotes
      : modalDocument === "temporaryContract"
        ? temporaryActiveNotes
        : addendumActiveNotes;
  const shouldRenderInlineDocument = Boolean(
    SelectedComponent &&
      selectedDocument !== "warnings" &&
      selectedDocument !== "disciplinaryHearingNotice" &&
      selectedDocument !== "incapacityPerformanceHearingNotice" &&
      selectedDocument !== "addendum" &&
      selectedDocument !== "noticeTermination" &&
      selectedDocument !== "illHealthTermination" &&
      selectedDocument !== "abscondmentTermination" &&
      selectedDocument !== "retrenchmentTermination" &&
      selectedDocument !== "retirementTermination" &&
      selectedDocument !== "mutualTermination" &&
      selectedDocument !== "poorPerformanceTermination" &&
      selectedDocument !== "permanentContract" &&
      selectedDocument !== "temporaryContract",
  );
  const greetingName = profile?.user_name ?? "";
  const breadcrumbParts: string[] = [];
  if (breadcrumbCategoryTitle) breadcrumbParts.push(breadcrumbCategoryTitle);
  if (activeDocumentLabel) breadcrumbParts.push(activeDocumentLabel);
  if (breadcrumbStep) breadcrumbParts.push(breadcrumbStep);

  return (
    <DashboardLayout profileSubtitleMode="company">
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-blue-600 -ml-1">Documents</h1>
                <p className="text-xs text-slate-600 mt-2">
                  Generate HR documents quickly with guided step-by-step forms.
                </p>
              </div>
              <div className="border-b border-slate-300 bg-white shadow-sm mt-2">
                <div className="relative flex flex-wrap items-center gap-0 px-0 py-0">
                  {documentCategories.map((category, index) => {
                    const isSelectedCategory = activeCategoryTitle === category.title;
                    const hasItems = category.items.length > 0;
                    return (
                      <div
                        key={category.title}
                        className="relative"
                        onMouseEnter={() => setOpenCategory(category.title)}
                        onMouseLeave={() => setOpenCategory("")}
                      >
                        <button
                          type="button"
                          className={cn(
                            "h-[38px] min-w-[140px] rounded-none border-b-0 border-transparent px-3 text-xs font-medium transition-all duration-150",
                            isSelectedCategory
                              ? "bg-white text-black border-b-2 border-blue-500 font-semibold"
                              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 hover:border-b-0 hover:border-transparent",
                          )}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="text-xs">{category.title}</span>
                            <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
                          </span>
                        </button>
                        {openCategory === category.title && hasItems && (
                          <div className="absolute left-0 top-full z-30 min-w-[180px] rounded-b-sm border border-slate-200 bg-white">
                            <div className="flex flex-col">
                              {category.items.map((item) =>
                                item.active && item.id ? (
                                  <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => {
                                      if (
                                        item.id === "warnings" ||
                                        item.id === "disciplinaryHearingNotice" ||
                                        item.id === "incapacityPerformanceHearingNotice" ||
                                        item.id === "addendum" ||
                                        item.id === "noticeTermination" ||
                                        item.id === "illHealthTermination" ||
                                        item.id === "abscondmentTermination" ||
                                        item.id === "retrenchmentTermination" ||
                                        item.id === "retirementTermination" ||
                                        item.id === "mutualTermination" ||
                                        item.id === "poorPerformanceTermination" ||
                                        item.id === "permanentContract" ||
                                        item.id === "temporaryContract"
                                      ) {
                                        setSelectedDocument(item.id);
                                        setStepMeta(null);
                                        setBreadcrumbStep(null);
                                        setModalDocument(
                                          item.id as
                                            | "warnings"
                                            | "disciplinaryHearingNotice"
                                            | "incapacityPerformanceHearingNotice"
                                            | "addendum"
                                            | "noticeTermination"
                                            | "illHealthTermination"
                                            | "abscondmentTermination"
                                            | "retrenchmentTermination"
                                            | "retirementTermination"
                                            | "mutualTermination"
                                            | "poorPerformanceTermination"
                                            | "permanentContract"
                                            | "temporaryContract",
                                        );
                                        return;
                                      }
                                      setSelectedDocument(item.id!);
                                    }}
                                    className={cn(
                                      "w-full rounded-none border-b-2 border-transparent px-3 py-2 text-left text-xs transition-all duration-150",
                                      "text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-0",
                                      selectedDocument === item.id &&
                                        "bg-white text-black border-b-0 border-transparent font-semibold",
                                    )}
                                  >
                                    {item.label}
                                  </button>
                                ) : (
                                  <div
                                    key={item.label}
                                    className="w-full rounded-none px-3 py-2 text-left text-xs text-slate-400"
                                  >
                                    {item.label}
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {SelectedComponent &&
            stepMeta?.steps?.length &&
            selectedDocument !== "codeOfConduct" &&
            selectedDocument !== "warnings" &&
            selectedDocument !== "disciplinaryHearingNotice" &&
            selectedDocument !== "incapacityPerformanceHearingNotice" &&
            selectedDocument !== "addendum" &&
            selectedDocument !== "noticeTermination" &&
            selectedDocument !== "illHealthTermination" &&
            selectedDocument !== "abscondmentTermination" &&
            selectedDocument !== "retrenchmentTermination" &&
            selectedDocument !== "retirementTermination" &&
            selectedDocument !== "mutualTermination" &&
            selectedDocument !== "poorPerformanceTermination" ? (
              <div className="pl-4 pr-2 pt-6 pb-0.5">
                <div className="space-y-2">
                  <div className="flex items-start">
                    <div className="w-[140px] flex justify-start ml-[300px]">
                      {stepMeta.onBack ? (
                        <button
                          type="button"
                          onClick={stepMeta.onBack}
                          disabled={!stepMeta.canGoBack}
                          className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:underline disabled:text-slate-300 disabled:cursor-not-allowed"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          {stepMeta.isFinished ? "Back to form" : "Previous step"}
                        </button>
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <div className="space-y-3">
                        <div className="relative px-3">
                          <div
                            className={`absolute left-[96px] right-[96px] top-1/2 h-[2px] -translate-y-1/2 ${
                              stepMeta.isFinished ? "bg-emerald-200" : "bg-blue-200"
                            }`}
                          >
                            <div
                              className={`absolute left-0 top-0 h-full transition-[width] ${
                                stepMeta.isFinished ? "bg-emerald-500" : "bg-blue-600"
                              }`}
                              style={{
                                width:
                                  stepMeta.steps.length > 1
                                    ? `${(stepMeta.activeStep / (stepMeta.steps.length - 1)) * 100}%`
                                    : "0%",
                              }}
                            />
                          </div>
                          <div
                            className="grid items-center"
                            style={{
                              gridTemplateColumns: `repeat(${stepMeta.steps.length}, minmax(0, 1fr))`,
                            }}
                          >
                            {stepMeta.steps.map((step, index) => {
                              const isDone = index <= stepMeta.activeStep;
                              const isFinished = Boolean(stepMeta.isFinished);
                              return (
                                <div key={step} className="relative z-10 flex h-6 w-6 items-center justify-center justify-self-center rounded-full">
                                  <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                                      isDone
                                        ? isFinished
                                          ? "border-emerald-500 bg-emerald-500"
                                          : "border-blue-600 bg-blue-600"
                                        : "border-blue-200 bg-white"
                                    }`}
                                  >
                                    {isDone ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div
                          className="grid px-3"
                          style={{
                            gridTemplateColumns: `repeat(${stepMeta.steps.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {stepMeta.steps.map((step, index) => {
                            const Icon = stepMeta.icons?.[index];
                            const isDone = index <= stepMeta.activeStep;
                            const isActive = index === stepMeta.activeStep;
                            const isFinished = Boolean(stepMeta.isFinished);
                            return (
                              <div key={step} className="flex flex-col items-center gap-1 text-center">
                                {Icon ? (
                                  <Icon
                                    className={`h-4 w-4 ${
                                      isFinished ? "text-black" : isActive ? "text-blue-600" : isDone ? "text-black" : "text-slate-400"
                                    }`}
                                  />
                                ) : null}
                                <span
                                  className={`text-[11px] font-medium ${
                                    isFinished ? "text-black" : isActive ? "text-blue-600" : isDone ? "text-black" : "text-slate-500"
                                  }`}
                                >
                                  {step}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="w-[140px] flex justify-end mr-[300px]">
                      {stepMeta.onNext && !stepMeta.isFinished ? (
                        <button
                          type="button"
                          onClick={stepMeta.onNext}
                          disabled={!stepMeta.canGoNext}
                          className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:underline disabled:text-slate-300 disabled:cursor-not-allowed"
                        >
                          {stepMeta.activeStep >= stepMeta.steps.length - 1 ? "Finish" : "Next step"}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <section
              ref={contentScrollRef}
              data-documents-scroll
              className="relative flex-1 overflow-y-auto overflow-x-hidden pr-2"
            >
              {shouldRenderInlineDocument ? (
                <Suspense
                  fallback={
                    <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
                      Loading document...
                    </div>
                  }
                >
                  <div className="space-y-2 mt-2 pl-4 pr-2">
                    <SelectedComponent
                      embedded
                      onStepChange={setBreadcrumbStep}
                      onStepMetaChange={setStepMeta}
                    />
                  </div>
                </Suspense>
              ) : (
                <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
                  <div className="space-y-2">
                    <p className="text-3xl font-semibold text-slate-800">
                      Hi
                      {greetingName ? (
                        <>
                          , <span className="text-blue-600">{greetingName}</span>
                        </>
                      ) : null}
                      .
                    </p>
                    <p className="text-sm text-slate-600">
                      Please select the document you wish to generate, and let's draft it together.
                    </p>
                  </div>
                  <img
                    src="/hello_Illustration(2).png"
                    alt="Hello"
                    className="mt-10 w-full max-w-[420px] object-contain"
                  />
                </div>
              )}
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
            </section>
          </div>
        </div>
      </div>
      <Dialog
        open={Boolean(modalDocument)}
        onOpenChange={(open) => {
          if (open) return;
          setModalDocument(null);
          if (!open) {
            setStepMeta(null);
            setBreadcrumbStep(null);
          }
        }}
      >
      <DialogContent
        className={cn(
          "p-0 [&>button]:right-5 [&>button]:top-4",
          modalDocument === "warnings"
            || modalDocument === "disciplinaryHearingNotice"
            || modalDocument === "incapacityPerformanceHearingNotice"
            || modalDocument === "addendum"
            || modalDocument === "noticeTermination"
            || modalDocument === "illHealthTermination"
            || modalDocument === "abscondmentTermination"
            || modalDocument === "retrenchmentTermination"
            || modalDocument === "retirementTermination"
            || modalDocument === "mutualTermination"
            || modalDocument === "poorPerformanceTermination"
            || modalDocument === "permanentContract"
            || modalDocument === "temporaryContract"
            ? "no-modal-shadow h-[90vh] max-w-[1240px] rounded-sm border-0 bg-[#f7f9fb] !shadow-none overflow-hidden"
            : "h-[90vh] max-w-[1320px] overflow-hidden border border-slate-200",
        )}
      >
          <DialogTitle className="sr-only">{modalTitle} Generator</DialogTitle>
          {modalDocument === "warnings" ||
          modalDocument === "disciplinaryHearingNotice" ||
          modalDocument === "incapacityPerformanceHearingNotice" ||
          modalDocument === "addendum" ||
          modalDocument === "noticeTermination" ||
          modalDocument === "illHealthTermination" ||
          modalDocument === "abscondmentTermination" ||
          modalDocument === "retrenchmentTermination" ||
          modalDocument === "retirementTermination" ||
          modalDocument === "mutualTermination" ||
          modalDocument === "poorPerformanceTermination" ||
          modalDocument === "permanentContract" ||
          modalDocument === "temporaryContract" ? (
            <div className="flex h-full min-h-0 flex-col bg-[#f7f9fb]">
              <header className="flex items-center justify-between px-6 pt-4 pb-3">
                <div className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-[10px] text-slate-500">
                  <Menu className="h-3.5 w-3.5 -ml-1" />
                  <span className="font-semibold text-slate-700">
                    {`Documents / ${
                      modalDocument === "warnings"
                        ? "Discipline"
                        : modalDocument === "disciplinaryHearingNotice"
                          ? "Notices"
                        : modalDocument === "incapacityPerformanceHearingNotice"
                          ? "Notices"
                        : modalDocument === "noticeTermination" ||
                          modalDocument === "illHealthTermination" ||
                          modalDocument === "abscondmentTermination" ||
                          modalDocument === "retrenchmentTermination" ||
                          modalDocument === "retirementTermination" ||
                          modalDocument === "mutualTermination" ||
                          modalDocument === "poorPerformanceTermination"
                          ? modalDocument === "mutualTermination"
                            ? "Terminations"
                            : "Termination Letter"
                          : "Contracts"
                    } / ${
                      modalDocument === "addendum"
                        ? "Addendum"
                        : modalDocument === "disciplinaryHearingNotice"
                          ? "Disciplinary Hearing"
                        : modalDocument === "incapacityPerformanceHearingNotice"
                          ? "Incapacity Hearing (Performance)"
                        : modalDocument === "illHealthTermination"
                          ? "Ill Health"
                        : modalDocument === "abscondmentTermination"
                          ? "Abscondment/Desertion"
                        : modalDocument === "retrenchmentTermination"
                          ? "Retrenchment"
                        : modalDocument === "retirementTermination"
                          ? "Retirement"
                        : modalDocument === "mutualTermination"
                          ? "Mutual Seperation Agreement"
                        : modalDocument === "poorPerformanceTermination"
                          ? "Poor Performance"
                        : modalDocument === "noticeTermination"
                          ? "Misconduct"
                        : modalDocument === "temporaryContract"
                          ? "Temporary Contract"
                          : modalDocument === "permanentContract"
                            ? "Permanent Contract"
                            : "Warning Form"
                    }`}
                  </span>
                </div>
              </header>
              <div className="min-h-0 flex-1 px-6 pb-4">
                <div className="flex h-full min-h-0 items-stretch gap-4">
                  <aside className="h-full w-[280px] rounded-sm border border-slate-300 bg-white p-4">
                    <div className="space-y-3">
                      {modalSteps.map((step, index) => {
                        const isActive = index === modalActiveStep;
                        const isComplete = index < modalActiveStep;
                        const isClickable = canSelectTrackerStep(index);
                        const itemClasses = cn(
                          "flex items-start gap-3 rounded-sm border px-3 py-2 transition-colors",
                          isActive
                            ? "border-blue-300 bg-blue-50"
                            : isComplete
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-slate-300 bg-white",
                          isClickable && "cursor-pointer hover:border-blue-300 hover:bg-blue-50/40",
                        );
                        const itemContent = (
                          <>
                            <span
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                                isActive
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : isComplete
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : "border-slate-300 bg-white text-slate-500",
                              )}
                            >
                              {isComplete ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
                            </span>
                            <span
                              className={cn(
                                "text-left text-xs font-semibold leading-5",
                                isActive ? "text-blue-700" : isComplete ? "text-emerald-700" : "text-slate-600",
                              )}
                            >
                              {step}
                            </span>
                          </>
                        );
                        return isClickable ? (
                          <button
                            key={step}
                            type="button"
                            onClick={() => handleTrackerStepSelect(index)}
                            className={cn(itemClasses, "w-full text-left")}
                          >
                            {itemContent}
                          </button>
                        ) : (
                          <div key={step} className={itemClasses}>
                            {itemContent}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-sm bg-white px-3 py-3">
                      <h3 className="mb-[11px] text-[11px] font-semibold uppercase tracking-wide text-blue-700">Notes:</h3>
                      <p className="mt-1 text-[11px] font-semibold text-slate-600 underline decoration-slate-500 underline-offset-2">
                        {activeModalStepLabel}
                      </p>
                      <div className="mt-2 space-y-2">
                        {modalActiveNotes.map((note, index) => {
                          const isExampleLabel = note === "Example:";
                          const isNbNote = note.startsWith("NB! ");
                          const noteBody = isNbNote ? note.slice(4) : note;
                          return (
                            <p
                              key={index}
                              className={cn("text-[11px] leading-5 text-slate-600", isExampleLabel && "font-semibold")}
                            >
                              {isNbNote ? <strong>NB! </strong> : null}
                              {noteBody}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  </aside>
                  <div className="min-w-0 flex-1 min-h-0 flex flex-col">
                    <section
                      className={cn(
                        "relative min-h-0 overflow-hidden rounded-sm border border-slate-300 bg-white px-5 pt-2 pb-4",
                        modalDocument === "warnings"
                          ? stepMeta?.isFinished
                            ? "flex-1"
                            : "overflow-visible"
                          : "flex-1",
                      )}
                    >
                      <Suspense
                        fallback={
                          <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
                            Loading document generator...
                          </div>
                        }
                      >
                        <div className="h-full min-h-0">
                          {ModalComponent ? (
                            <ModalComponent
                              embedded
                              externalNavigation
                              onStepChange={setBreadcrumbStep}
                              onStepMetaChange={setStepMeta}
                            />
                          ) : null}
                        </div>
                      </Suspense>
                    </section>
                    <div className="mt-3 grid grid-cols-3 items-center">
                      <div className="justify-self-start">
                        <button
                          type="button"
                          onClick={() => stepMeta?.onBack?.()}
                          disabled={!stepMeta?.canGoBack}
                          className="h-[28px] w-[84px] rounded border border-blue-600 px-3 text-xs font-semibold text-blue-600 hover:bg-transparent hover:text-blue-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-300"
                        >
                          Back
                        </button>
                      </div>
                      <div className="justify-self-center">
                        {stepMeta?.onClear &&
                        (((stepMeta?.activeStep ?? 0) > 0 && !stepMeta?.isFinished) ||
                          (stepMeta?.isFinished && stepMeta?.supportsPreviewEditToggle)) ? (
                          <button
                            type="button"
                            onClick={() => stepMeta.onClear?.()}
                            className={cn(
                              "inline-flex h-[28px] w-[84px] items-center justify-center gap-1.5 rounded border bg-white text-xs font-semibold disabled:cursor-not-allowed",
                              stepMeta?.isFinished
                                ? "border-slate-300 text-slate-600 hover:border-blue-600 hover:bg-white hover:text-blue-600 disabled:border-slate-300 disabled:text-slate-300"
                                : "border-transparent text-slate-700 hover:border-transparent hover:bg-white hover:text-blue-600 disabled:text-slate-300",
                            )}
                          >
                            {!stepMeta?.isFinished ? <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                            {stepMeta?.isFinished
                              ? stepMeta?.isPreviewEditable
                                ? "Save"
                                : "Edit"
                              : "Reset"}
                          </button>
                        ) : null}
                      </div>
                      <div className="justify-self-end">
                        <button
                          type="button"
                          onClick={() => stepMeta?.onNext?.()}
                          disabled={!stepMeta?.canGoNext}
                          className="h-[28px] w-[84px] rounded bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {stepMeta?.isFinished ? "Download" : "Next"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 bg-slate-50">
              <aside className="w-[280px] border-r border-slate-200 bg-white p-5">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Discipline</p>
                  <h2 className="text-base font-semibold text-slate-900">{modalTitle}</h2>
                </div>
                <div className="mt-6 space-y-3">
                  {modalSteps.map((step, index) => {
                    const isActive = index === modalActiveStep;
                    const isComplete = index < modalActiveStep;
                    const isClickable = canSelectTrackerStep(index);
                    const itemClasses = cn(
                      "flex items-start gap-3 rounded-sm border px-3 py-2 transition-colors",
                      isActive
                        ? "border-blue-300 bg-blue-50"
                        : isComplete
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-white",
                      isClickable && "cursor-pointer hover:border-blue-300 hover:bg-blue-50/40",
                    );
                    const itemContent = (
                      <>
                        <span
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                            isActive
                              ? "border-blue-600 bg-blue-600 text-white"
                              : isComplete
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-300 bg-white text-slate-500",
                          )}
                        >
                          {index + 1}
                        </span>
                        <span
                          className={cn(
                            "text-left text-xs font-semibold leading-5",
                            isActive ? "text-blue-700" : isComplete ? "text-emerald-700" : "text-slate-600",
                          )}
                        >
                          {step}
                        </span>
                      </>
                    );
                    return isClickable ? (
                      <button
                        key={step}
                        type="button"
                        onClick={() => handleTrackerStepSelect(index)}
                        className={cn(itemClasses, "w-full text-left")}
                      >
                        {itemContent}
                      </button>
                    ) : (
                      <div key={step} className={itemClasses}>
                        {itemContent}
                      </div>
                    );
                  })}
                </div>
              </aside>
              <section className="min-w-0 flex-1 overflow-y-auto bg-white px-5 py-4">
                <Suspense
                  fallback={
                    <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
                      Loading document generator...
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {ModalComponent ? (
                      <ModalComponent
                        embedded
                        onRequestClose={() => {
                          setModalDocument(null);
                          setStepMeta(null);
                          setBreadcrumbStep(null);
                        }}
                        onStepChange={setBreadcrumbStep}
                        onStepMetaChange={setStepMeta}
                      />
                    ) : null}
                  </div>
                </Suspense>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Documents;

