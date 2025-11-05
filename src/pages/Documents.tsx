import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileWarning,
  FileSignature,
  FileText,
  FileOutput,
  Stamp,
  ClipboardCheck,
} from "lucide-react";

const documents = [
  {
    title: "Written Warning",
    description: "Generate a customised written warning complete with employee and company details.",
    icon: FileWarning,
    actionLabel: "Generate",
    onClick: (navigate: ReturnType<typeof useNavigate>) => navigate("/warning-generator"),
    status: "available" as const,
  },
  {
    title: "Employment Contract (Permanent)",
    description: "Create a permanent employment contract tailored to your organisation.",
    icon: FileSignature,
    actionLabel: "Coming Soon",
    status: "upcoming" as const,
  },
  {
    title: "Employment Contract (Temporary)",
    description: "Generate a temporary or fixed-term employment agreement.",
    icon: FileSignature,
    actionLabel: "Coming Soon",
    status: "upcoming" as const,
  },
  {
    title: "Notice of Hearing",
    description: "Prepare formal notices for disciplinary or grievance hearings.",
    icon: FileText,
    actionLabel: "Coming Soon",
    status: "upcoming" as const,
  },
  {
    title: "Notice of Termination",
    description: "Draft notices for misconduct, retrenchment, retirement, or end-of-contract terminations.",
    icon: FileOutput,
    actionLabel: "Coming Soon",
    status: "upcoming" as const,
  },
  {
    title: "Certificate of Service",
    description: "Issue certificates of service in line with labour requirements.",
    icon: Stamp,
    actionLabel: "Coming Soon",
    status: "upcoming" as const,
  },
  {
    title: "Counselling Form",
    description: "Document informal counselling sessions with employees.",
    icon: ClipboardCheck,
    actionLabel: "Coming Soon",
    status: "upcoming" as const,
  },
];

const Documents = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground max-w-2xl">
            Choose a document type to generate. More HR documents are on the way to help you manage every step of the
            employee lifecycle.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => {
            const Icon = doc.icon;
            const isAvailable = doc.status === "available";

            return (
              <Card key={doc.title} className="flex flex-col justify-between shadow-sm hover:shadow-lg transition-shadow">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </span>
                      <div>
                        <CardTitle>{doc.title}</CardTitle>
                        {doc.status === "upcoming" && (
                          <Badge variant="secondary" className="mt-1">
                            Coming soon
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <CardDescription>{doc.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    disabled={!isAvailable}
                    variant={isAvailable ? "default" : "outline"}
                    onClick={() => {
                      if (isAvailable && doc.onClick) {
                        doc.onClick(navigate);
                      }
                    }}
                  >
                    {doc.actionLabel}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Documents;
