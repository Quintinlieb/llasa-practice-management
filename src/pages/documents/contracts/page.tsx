import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";

type ContractDocument = {
  name: string;
  description: string;
  href: string;
  isActive: boolean;
};

const contractDocuments: ContractDocument[] = [
  {
    name: "Permanent Contract",
    description: "Generate a comprehensive permanent employment agreement with company branding.",
    href: "/documents/contracts/permanent",
    isActive: true,
  },
  {
    name: "Temporary Contract",
    description: "Create fixed-term or temporary contracts tailored to the assignment duration.",
    href: "/documents/contracts/temporary",
    isActive: false,
  },
  {
    name: "Notice of Termination",
    description: "Formalize the termination of an existing contract with clear conditions.",
    href: "/documents/contracts/notice-of-termination",
    isActive: false,
  },
  {
    name: "Extension of Fixed-Term Contract",
    description: "Extend fixed-term engagements while keeping documentation compliant.",
    href: "/documents/contracts/extension",
    isActive: false,
  },
  {
    name: "Renewal of Fixed-Term Contract",
    description: "Renew fixed-term agreements without redoing the entire contract.",
    href: "/documents/contracts/renewal",
    isActive: false,
  },
];

const ContractsDocumentsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Contracts</p>
          <h1 className="text-3xl font-bold text-gray-900">Generate contract documents</h1>
          <p className="text-base text-gray-600">
            Keep employment agreements organized and compliant with ready-made templates.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {contractDocuments.map((doc) => (
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

export default ContractsDocumentsPage;
