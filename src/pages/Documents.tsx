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
    <DashboardLayout>
      <div className="space-y-3 -ml-6 -mr-6 pl-3 pr-3 -mt-3">
        <header className="rounded-sm px-5 py-4 space-y-1 bg-white border border-slate-300">
          <h1 className="text-xl font-bold uppercase text-blue-700">Generate HR Documents</h1>
          <p className="text-xs text-gray-600 max-w-3xl">
            One hub for your HR paperwork. Generate the documents you need instantly.
          </p>
        </header>

        <div className="rounded-sm border border-slate-300 bg-white/55 shadow-sm min-h-[70vh] pb-0">
          <div className="grid h-[74vh] gap-3 lg:grid-cols-[180px_1fr] items-stretch">
            <aside className="h-full border-b border-slate-200 bg-[#2D4256] text-white lg:border-b-0 lg:border-r lg:border-slate-200 rounded-l-sm">
              <div className="flex flex-col">
                {documentCategories.map((category, index) => {
                  const isOpen = openCategory === category.title;
                  const isActive = activeCategoryTitle === category.title;
                  const CategoryIcon = category.icon;
                  return (
                    <div key={category.title} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenCategory((prev) => (prev === category.title ? "" : category.title))
                        }
                        className={cn(
                          "group flex h-[42px] w-full items-center gap-3 rounded-none border-b border-white/10 px-4 py-0 text-left text-xs leading-none transition-all duration-150",
                          "hover:bg-[#010D1A] hover:text-white",
                          index === 0 && "rounded-tl-sm",
                          (isOpen || isActive) && "bg-[#010D1A] text-white",
                          isActive && "border-b-2 border-blue-500",
                        )}
                      >
                        <CategoryIcon className="h-4 w-4 text-white" />
                        <span className="flex flex-1 items-center justify-between gap-2">
                          <span className="text-xs font-normal text-white">
                            {category.title}
                          </span>
                          <ChevronDownIcon
                            className={cn(
                              "h-3.5 w-3.5 text-white transition-transform duration-150",
                              isOpen && "rotate-180",
                            )}
                          />
                        </span>
                      </button>
                      {isOpen && (
                        <div className="border-b border-white/10 bg-[#233549] px-2 py-2">
                          <div className="flex flex-col gap-1">
                            {category.items.map((item) =>
                              item.active && item.id ? (
                                <button
                                  key={item.label}
                                  type="button"
                                  onClick={() => setSelectedDocument(item.id!)}
                                  className={cn(
                                    "w-full rounded-none border-l-2 border-transparent px-2 py-2 text-left text-[11px]",
                                    "text-white/80 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-0",
                                    selectedDocument === item.id && "bg-white/10 text-white border-blue-500",
                                  )}
                                >
                                  {item.label}
                                </button>
                              ) : (
                                <div
                                  key={item.label}
                                  className="w-full rounded-none px-2 py-2 text-left text-[11px] text-white/40"
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
            </aside>

            <section
              ref={contentScrollRef}
              data-documents-scroll
              className="relative h-full overflow-y-auto overflow-x-hidden"
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
