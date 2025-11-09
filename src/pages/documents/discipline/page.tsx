import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";

type DisciplineDocument = {
  name: string;
  description: string;
  href: string;
  isActive: boolean;
};

const disciplineDocuments: DisciplineDocument[] = [
  {
    name: "Warnings",
    description: "Generate formal warnings with pre-filled employee and company data.",
    href: "/documents/discipline/warnings",
    isActive: true,
  },
  {
    name: "Code of Conduct",
    description: "Share organisation-specific conduct guidelines with your teams.",
    href: "/documents/discipline/code-of-conduct/preview",
    isActive: true,
  },
  {
    name: "Notice of Hearing",
    description: "Prepare notices containing hearing details and next steps.",
    href: "/documents/discipline/notice-of-hearing",
    isActive: false,
  },
  {
    name: "Notice of Termination",
    description: "Draft termination notices aligned with disciplinary outcomes.",
    href: "/documents/discipline/notice-of-termination",
    isActive: false,
  },
  {
    name: "Notice of Counselling",
    description: "Document informal counselling conversations for record keeping.",
    href: "/documents/discipline/notice-of-counselling",
    isActive: false,
  },
  {
    name: "Counselling Report",
    description: "Capture the decisions and actions that stem from counselling.",
    href: "/documents/discipline/counselling-report",
    isActive: false,
  },
];

const DisciplineDocumentsPage = () => {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-6 py-6 md:py-8">
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Discipline</p>
          <h1 className="text-3xl font-bold text-gray-900">Generate disciplinary documents</h1>
          <p className="text-base text-gray-600">
            Choose a document template to quickly prepare the disciplinary paperwork your team needs.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {disciplineDocuments.map((doc) => (
            <section
              key={doc.name}
              className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-150 hover:border-blue-500 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-white"
              aria-labelledby={doc.name.replace(/\s+/g, "-").toLowerCase()}
            >
              <div className="flex flex-1 flex-col space-y-3">
                <div className="space-y-1">
                  <h2 id={doc.name.replace(/\s+/g, "-").toLowerCase()} className="text-lg font-semibold text-gray-900">
                    {doc.name}
                  </h2>
                  <p className="text-sm text-gray-600">{doc.description}</p>
                </div>
              </div>
              <div className="mt-6 pt-2">
                {doc.isActive ? (
                  <Link
                    to={doc.href}
                    aria-label={`Open ${doc.name}`}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                  >
                    Let's go
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-label={`${doc.name} currently unavailable`}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-60 cursor-not-allowed"
                  >
                    Let's go
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DisciplineDocumentsPage;
