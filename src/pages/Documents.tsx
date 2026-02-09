import { Suspense, lazy, useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import {
  ScaleIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BellAlertIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { ArrowLeft, ArrowRight, Gavel } from "lucide-react";

type DocumentKey =
  | "codeOfConduct"
  | "warnings"
  | "permanentContract"
  | "temporaryContract"
  | "addendum"
  | "disciplinaryHearing";

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
  onStepChange?: (step: string | null) => void;
  onStepMetaChange?: (meta: {
    steps: readonly string[];
    activeStep: number;
    icons?: readonly ComponentType<SVGProps<SVGSVGElement>>[];
    canGoNext?: boolean;
    canGoBack?: boolean;
    onNext?: () => void;
    onBack?: () => void;
    isFinished?: boolean;
  }) => void;
};

const documentComponents: Record<DocumentKey, ComponentType<DocumentComponentProps>> = {
  codeOfConduct: lazy(() => import("./documents/discipline/CodeOfConductPreview")),
  warnings: lazy(() => import("./WarningGenerator")),
  permanentContract: lazy(() => import("./PermanentContractGenerator")),
  temporaryContract: lazy(() => import("./TemporaryContractGenerator")),
  addendum: lazy(() => import("./AddendumGenerator")),
  disciplinaryHearing: lazy(() => import("./DisciplinaryOutcomeGenerator")),
};

const documentCategories: DocumentCategory[] = [
  {
    title: "Discipline",
    icon: ScaleIcon,
    items: [
      { id: "codeOfConduct", label: "Code of Conduct", active: true },
      { id: "warnings", label: "Warnings", active: true },
      { label: "Counselling", active: false },
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
    title: "Performance",
    icon: ChartBarIcon,
    items: [{ label: "Performance Appraisal Form", active: false }],
  },
  {
    title: "Outcomes",
    icon: (props) => <Gavel {...props} />,
    items: [
      { id: "disciplinaryHearing", label: "Disciplinary Hearing", active: true },
      { label: "Incapacity Hearing", active: false },
      { label: "Retrenchment Consultation", active: false },
      { label: "Grievance", active: false },
    ],
  },
  {
    title: "Notices",
    icon: BellAlertIcon,
    items: [
      { label: "Notice of Hearing - Poor Performance", active: false },
      { label: "Notice of Demotion", active: false },
      { label: "Notice of Termination", active: false },
      { label: "Notice of Counselling", active: false },
      { label: "Notice of Contract Extension", active: false },
      { label: "Notice of Contract Renewal", active: false },
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
  const [stepMeta, setStepMeta] = useState<{
    steps: readonly string[];
    activeStep: number;
    icons?: readonly ComponentType<SVGProps<SVGSVGElement>>[];
    canGoNext?: boolean;
    canGoBack?: boolean;
    onNext?: () => void;
    onBack?: () => void;
    isFinished?: boolean;
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
  const activeCategoryTitle =
    selectedDocument
      ? documentCategories.find((category) =>
          category.items.some((item) => item.id === selectedDocument),
        )?.title ?? ""
      : "";
  const activeDocumentLabel =
    selectedDocument
      ? documentCategories
          .flatMap((category) => category.items)
          .find((item) => item.id === selectedDocument)?.label ?? ""
      : "";
  const greetingName = profile?.user_name ?? "";
  const breadcrumbParts: string[] = [];
  if (activeCategoryTitle) breadcrumbParts.push(activeCategoryTitle);
  if (activeDocumentLabel) breadcrumbParts.push(activeDocumentLabel);
  if (breadcrumbStep) breadcrumbParts.push(breadcrumbStep);

  return (
    <DashboardLayout profileSubtitleMode="company">
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-blue-600">Documents</h1>
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
                                    onClick={() => setSelectedDocument(item.id!)}
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

            {SelectedComponent && stepMeta?.steps?.length && selectedDocument !== "codeOfConduct" ? (
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
              {SelectedComponent ? (
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
    </DashboardLayout>
  );
};

export default Documents;
