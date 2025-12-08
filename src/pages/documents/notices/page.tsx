import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";

type NoticeDocument = {
  name: string;
  description: string;
  href: string;
  isActive: boolean;
};

const noticeDocuments: NoticeDocument[] = [
  {
    name: "Notice of Hearing - Poor Performance",
    description: "Notify employees of hearings related to ongoing performance shortfalls.",
    href: "/documents/notices/notice-of-hearing",
    isActive: false,
  },
  {
    name: "Notice of Demotion",
    description: "Document demotion decisions tied to sustained performance issues.",
    href: "/documents/notices/notice-of-demotion",
    isActive: false,
  },
  {
    name: "Notice of Termination",
    description: "Formalize termination outcomes for unresolved performance matters.",
    href: "/documents/notices/notice-of-termination",
    isActive: false,
  },
  {
    name: "Notice of Counselling",
    description: "Schedule or record counselling sessions for performance or conduct concerns.",
    href: "/documents/notices/notice-of-counselling",
    isActive: false,
  },
  {
    name: "Notice of Contract Extension",
    description: "Extend fixed-term engagements while keeping documentation compliant.",
    href: "/documents/notices/extension",
    isActive: false,
  },
  {
    name: "Notice of Contract Renewal",
    description: "Renew fixed-term agreements without redoing the entire contract.",
    href: "/documents/notices/renewal",
    isActive: false,
  },
];

const NoticesDocumentsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Notices</p>
          <h1 className="text-3xl font-bold text-gray-900">Generate notices</h1>
          <p className="text-base text-gray-600">
            Access all notice templates in one place.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {noticeDocuments.map((doc) => (
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

export default NoticesDocumentsPage;
