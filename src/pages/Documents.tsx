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
import { Gavel } from "lucide-react";

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
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  items: DocumentItem[];
};

type StoredProfile = {
  user_name?: string;
  user_surname?: string;
};

const documentComponents: Record<DocumentKey, ComponentType<{ embedded?: boolean }>> = {
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

  useEffect(() => {
    const nextSelected = (location.state as { selectedDocument?: DocumentKey } | null)?.selectedDocument;
    if (nextSelected && documentComponents[nextSelected]) {
      setSelectedDocument(nextSelected);
    }
  }, [location.state]);

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
  const greetingName = [profile?.user_name, profile?.user_surname].filter(Boolean).join(" ");

  return (
    <DashboardLayout profileSubtitleMode="company">
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-1 pt-4">
              <div className="pb-1">
                <h1 className="text-3xl font-normal text-slate-900">Documents</h1>
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
                            <span className="text-[11px]">{category.title}</span>
                            <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
                          </span>
                        </button>
                        {openCategory === category.title && hasItems && (
                          <div className="absolute left-0 top-full z-30 min-w-[180px] border border-slate-200 bg-white">
                            <div className="flex flex-col">
                              {category.items.map((item) =>
                                item.active && item.id ? (
                                  <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => setSelectedDocument(item.id!)}
                                    className={cn(
                                      "w-full rounded-none border-b-2 border-transparent px-3 py-2 text-left text-[11px] transition-all duration-150",
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
                                    className="w-full rounded-none px-3 py-2 text-left text-[11px] text-slate-400"
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

            <section
              ref={contentScrollRef}
              data-documents-scroll
              className="relative flex-1 overflow-y-auto overflow-x-hidden pl-4 pr-1"
            >
              {SelectedComponent ? (
                <Suspense
                  fallback={
                    <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
                      Loading document...
                    </div>
                  }
                >
                  <SelectedComponent embedded />
                </Suspense>
              ) : (
                <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-10 text-center">
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-slate-800">
                      Hi{greetingName ? `, ${greetingName}` : ""}.
                    </p>
                    <p className="text-sm text-slate-600">
                      Select a category and document to the left to start drafting.
                    </p>
                  </div>
                  <img
                    src="/Hello Illustration.png"
                    alt="Hello"
                    className="w-full max-w-[210px] object-contain"
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
