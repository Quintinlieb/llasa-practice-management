import { useNavigate } from "react-router-dom";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DocumentItem = {
  label: string;
  href?: string;
  active: boolean;
};

type DocumentCategory = {
  title: string;
  description: string;
  badgeClass: string;
  extraLink?: {
    label: string;
    href: string;
  };
  items: DocumentItem[];
};

const documentCategories: DocumentCategory[] = [
  {
    title: "Discipline",
    description: "Pick a discipline document below to generate in a few clicks.",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    items: [
      { label: "Warnings", href: "/documents/discipline/warnings", active: true },
      { label: "Counselling", active: false },
    ],
    extraLink: { label: "View Code of Conduct", href: "/documents/discipline/code-of-conduct/preview" },
  },
  {
    title: "Contracts",
    description: "Choose a contract type below to generate instantly.",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    items: [
      { label: "Permanent Contract", href: "/documents/contracts/permanent", active: true },
      { label: "Temporary Contract", href: "/documents/contracts/temporary", active: true },
      { label: "Addendum to Contract", href: "/documents/contracts/addendum", active: true },
    ],
  },
  {
    title: "Performance",
    description: "Select a performance document to create from this list.",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    items: [{ label: "Performance Appraisal Form", active: false }],
  },
  {
    title: "Notices",
    description: "Choose a notice template below to generate.",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
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
  const navigate = useNavigate();
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Documents</p>
          <h1 className="text-3xl font-bold text-gray-900">Generate HR Documents</h1>
          <p className="text-base text-gray-600 max-w-3xl">
            One hub for your HR paperwork. Generate the documents you need instantly.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
          {documentCategories.map((category) => {
            const isOpen = openCategory === category.title;
            return (
              <div
                key={category.title}
                onMouseEnter={() => setOpenCategory(category.title)}
                onMouseLeave={() => setOpenCategory(null)}
                className={cn(
                  "rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-lg",
                  isOpen && "shadow-lg ring-1 ring-blue-100",
                )}
              >
                <button
                  type="button"
                  className="w-full rounded-2xl px-4 py-4 text-left"
                  onFocus={() => setOpenCategory(category.title)}
                  onBlur={() => setOpenCategory(null)}
                >
                  <div className="flex flex-col gap-2">
                    <Badge
                      variant="outline"
                      className={cn("w-fit rounded-full px-3 py-1.5 text-sm font-semibold", category.badgeClass)}
                    >
                      {category.title}
                    </Badge>
                    <span className="text-[13px] leading-snug text-gray-600">
                      {category.description}{" "}
                      {category.extraLink && (
                        <button
                          type="button"
                          onClick={() => navigate(category.extraLink!.href)}
                          className="font-semibold text-blue-700 hover:text-blue-800 focus:outline-none focus:underline"
                        >
                          {category.extraLink.label}
                        </button>
                      )}
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1">
                    <div className="flex flex-wrap gap-2">
                      {category.items.map((item) =>
                        item.active && item.href ? (
                          <Button
                            key={item.label}
                            size="sm"
                            variant="outline"
                            className="rounded-full justify-start min-w-[12rem] text-xs bg-white border border-slate-200 text-slate-800 shadow-sm transition-all hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 hover:shadow"
                            onClick={() => navigate(item.href!)}
                          >
                            {item.label}
                          </Button>
                        ) : (
                          <Badge
                            key={item.label}
                            variant="outline"
                            className="rounded-full border-dashed bg-muted/30 text-muted-foreground min-w-[12rem] justify-center text-[12px]"
                          >
                            {item.label}
                          </Badge>
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
    </DashboardLayout>
  );
};

export default Documents;
