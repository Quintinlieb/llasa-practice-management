import { supabase } from "@/integrations/supabase/client";

type LogGeneratedDocumentArgs = {
  documentLabel: string;
  documentType: string;
  employeeName?: string | null;
  employeeSurname?: string | null;
  tradingName?: string | null;
  registeredName?: string | null;
  createdByName?: string | null;
};

const firstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const next = String(value ?? "").trim();
    if (next) return next;
  }
  return "";
};

const getSessionUserName = () => {
  try {
    const raw = sessionStorage.getItem("header:profile");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { user_name?: string; user_surname?: string };
    return `${String(parsed.user_name ?? "").trim()} ${String(parsed.user_surname ?? "").trim()}`.trim();
  } catch {
    return "";
  }
};

export const logGeneratedDocument = async ({
  documentLabel,
  documentType,
  employeeName,
  employeeSurname,
  tradingName,
  registeredName,
  createdByName,
}: LogGeneratedDocumentArgs): Promise<{ ok: true } | { ok: false; error: string }> => {
  const employeeFullName = `${String(employeeName ?? "").trim()} ${String(employeeSurname ?? "").trim()}`.trim();
  const safeEmployeeName = employeeFullName || "Employee";
  const safeLabel = String(documentLabel || "Document").trim() || "Document";
  const clientName =
    firstNonEmpty(tradingName, registeredName, "Unknown client");
  const actorName = firstNonEmpty(createdByName, getSessionUserName(), "System User");

  const payload = {
    document_name: `${safeEmployeeName} - ${safeLabel}`,
    document_type: String(documentType || "Other").trim() || "Other",
    client_name: clientName,
    created_by_name: actorName,
  };
  const attempts: Array<Record<string, unknown>> = [
    payload,
    {
      document_name: `${safeEmployeeName} - ${safeLabel}`,
      document_type: String(documentType || "Other").trim() || "Other",
      client_name: clientName,
    },
  ];

  let lastErrorMessage = "";
  for (const candidate of attempts) {
    const { error } = await (supabase as any).from("documents").insert(candidate);
    if (!error) return { ok: true };
    lastErrorMessage = error.message ?? "Unknown documents insert error.";
  }

  console.error("Failed to log generated document:", lastErrorMessage);
  return { ok: false, error: lastErrorMessage };
};
