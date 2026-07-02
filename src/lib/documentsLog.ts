import { supabase } from "@/integrations/supabase/client";
import { formatActivityDate, getActivityKeyForDocument, logActivity } from "@/lib/activityLog";

type LogGeneratedDocumentArgs = {
  documentLabel: string;
  documentType: string;
  documentName?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  fileUrl?: string | null;
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

const getSessionAuthUser = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
};

const getResolvedCurrentUserName = async () => {
  const user = await getSessionAuthUser();
  if (!user?.id) return "";

  const { data: profileData } = await (supabase as any)
    .from("profiles")
    .select("user_name, user_surname")
    .eq("id", user.id)
    .maybeSingle();

  const profileName = `${String((profileData as any)?.user_name || "").trim()} ${String((profileData as any)?.user_surname || "").trim()}`.trim();
  if (profileName) return profileName;

  const { data: subuserData } = await (supabase as any)
    .from("subusers")
    .select("name,surname")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const subuserName = `${String((subuserData as any)?.name || "").trim()} ${String((subuserData as any)?.surname || "").trim()}`.trim();
  if (subuserName) return subuserName;

  return `${String((user as any)?.user_metadata?.user_name || (user as any)?.user_metadata?.name || "").trim()} ${String((user as any)?.user_metadata?.user_surname || (user as any)?.user_metadata?.surname || "").trim()}`.trim();
};

export const logGeneratedDocument = async ({
  documentLabel,
  documentType,
  documentName,
  clientId,
  clientName: explicitClientName,
  fileUrl,
  employeeName,
  employeeSurname,
  tradingName,
  registeredName,
  createdByName,
}: LogGeneratedDocumentArgs): Promise<{ ok: true; documentId?: string } | { ok: false; error: string }> => {
  const employeeFullName = `${String(employeeName ?? "").trim()} ${String(employeeSurname ?? "").trim()}`.trim();
  const safeEmployeeName = employeeFullName || "Employee";
  const safeLabel = String(documentLabel || "Document").trim() || "Document";
  const resolvedDocumentName = firstNonEmpty(documentName, `${safeEmployeeName} - ${safeLabel}`);
  const clientName = firstNonEmpty(explicitClientName, tradingName, registeredName, "Unknown client");
  const resolvedCurrentUserName = await getResolvedCurrentUserName();
  const actorName = firstNonEmpty(createdByName, resolvedCurrentUserName, "Unknown User");
  const authUserId = String((await getSessionAuthUser())?.id || "").trim();
  const resolvedClientId = String(clientId ?? "").trim();

  const payload = {
    document_name: resolvedDocumentName,
    document_type: String(documentType || "Other").trim() || "Other",
    client_name: clientName,
    ...(resolvedClientId ? { client_id: resolvedClientId } : {}),
    created_by_name: actorName,
    ...(String(fileUrl ?? "").trim() ? { file_url: String(fileUrl).trim() } : {}),
  };
  const attempts: Array<Record<string, unknown>> = [
    payload,
    {
      ...payload,
      ...(authUserId ? { created_by: authUserId } : {}),
    },
    {
      document_name: resolvedDocumentName,
      document_type: String(documentType || "Other").trim() || "Other",
      client_name: clientName,
      created_by_name: actorName,
      ...(resolvedClientId ? { client_id: resolvedClientId } : {}),
      ...(String(fileUrl ?? "").trim() ? { file_url: String(fileUrl).trim() } : {}),
    },
  ];

  let lastErrorMessage = "";
  for (const candidate of attempts) {
    const { data, error } = await (supabase as any).from("documents").insert(candidate).select("id,created_at").single();
    if (!error) {
      const documentId = String((data as any)?.id || "").trim();
      void logActivity({
        activityKey: getActivityKeyForDocument(safeLabel, String(documentType || "Other")),
        actionSentence: `${actorName} generated ${resolvedDocumentName} on ${formatActivityDate((data as any)?.created_at || new Date())}`,
        actorUserId: authUserId,
        actorName,
        sourceTable: "documents",
        sourceRecordId: documentId || undefined,
        clientId: resolvedClientId || undefined,
        clientName,
        documentType: String(documentType || "Other").trim() || "Other",
        occurredAt: String((data as any)?.created_at || new Date().toISOString()),
        metadata: {
          document_label: safeLabel,
          document_name: resolvedDocumentName,
        },
      });
      return { ok: true, documentId };
    }
    lastErrorMessage = error.message ?? "Unknown documents insert error.";
  }

  console.error("Failed to log generated document:", lastErrorMessage);
  return { ok: false, error: lastErrorMessage };
};
