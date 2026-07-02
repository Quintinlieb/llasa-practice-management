import { supabase } from "@/integrations/supabase/client";

type ActivityRule = {
  activity_key: string;
  activity_group: string;
  activity_label: string;
  points: number;
  is_productive?: boolean;
  active?: boolean;
};

export type ActivityLogInput = {
  activityKey: string;
  actionSentence: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  actorSource?: string | null;
  sourceTable?: string | null;
  sourceRecordId?: string | null;
  parentTable?: string | null;
  parentId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  matterId?: string | null;
  matterFileNumber?: string | null;
  matterType?: string | null;
  documentType?: string | null;
  occurredAt?: string | null;
  activityDate?: string | null;
  metadata?: Record<string, unknown>;
};

export const formatActivityDate = (value?: string | Date | null) => {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const firstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const next = String(value ?? "").trim();
    if (next) return next;
  }
  return "";
};

export const getActivityKeyForClientNoteType = (noteType: string) => {
  const normalized = noteType.trim().toLowerCase();
  if (normalized === "email sent") return "client_note_email_sent";
  if (normalized === "email received") return "client_note_email_received";
  if (normalized.startsWith("whatsapp")) return "client_note_whatsapp";
  if (normalized.includes("call")) return "client_note_call";
  if (normalized === "consultation") return "client_note_consultation";
  if (normalized === "chairing") return "client_note_chairing";
  return "client_note_basic";
};

export const getClientNoteVerb = (noteType: string) => {
  const normalized = noteType.trim().toLowerCase();
  if (normalized === "email sent") return "sent an email";
  if (normalized === "email received") return "received an email";
  if (normalized === "whatsapp out") return "sent a WhatsApp";
  if (normalized === "whatsapp in") return "received a WhatsApp";
  if (normalized === "incoming call") return "received a call";
  if (normalized === "outgoing call") return "made a call";
  if (normalized === "consultation") return "held a consultation";
  if (normalized === "chairing") return "chaired a matter";
  if (normalized === "representation") return "handled representation";
  if (normalized === "facilitation") return "handled facilitation";
  if (normalized.startsWith("draft")) return `drafted ${noteType.replace(/^draft\s*/i, "").trim() || "a document"}`;
  return "made a client file note";
};

export const getActivityKeyForDocument = (documentLabel: string, documentType: string) => {
  const text = `${documentLabel} ${documentType}`.toLowerCase();
  if (text.includes("outcome") && text.includes("hearing")) return "document_outcome_hearing";
  if (text.includes("warning")) return "document_warning";
  return "document_basic";
};

export const taskCreatedActivityKey = "task_created";

const getSessionAuthUser = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
};

export const getResolvedActivityActor = async () => {
  const user = await getSessionAuthUser();
  if (!user?.id) {
    return {
      actorUserId: "",
      actorName: "Unknown User",
      actorRole: "",
      actorSource: "unknown",
    };
  }

  const { data: profileData } = await (supabase as any)
    .from("profiles")
    .select("user_name,user_surname")
    .eq("id", user.id)
    .maybeSingle();
  const profileName = `${String((profileData as any)?.user_name || "").trim()} ${String((profileData as any)?.user_surname || "").trim()}`.trim();
  if (profileName) {
    return {
      actorUserId: user.id,
      actorName: profileName,
      actorRole: "Main",
      actorSource: "profiles",
    };
  }

  const { data: subuserData } = await (supabase as any)
    .from("subusers")
    .select("name,surname,role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const subuserName = `${String((subuserData as any)?.name || "").trim()} ${String((subuserData as any)?.surname || "").trim()}`.trim();
  if (subuserName) {
    return {
      actorUserId: user.id,
      actorName: subuserName,
      actorRole: String((subuserData as any)?.role || "").trim(),
      actorSource: "subusers",
    };
  }

  const metaName = `${String((user as any)?.user_metadata?.user_name || (user as any)?.user_metadata?.name || "").trim()} ${String((user as any)?.user_metadata?.user_surname || (user as any)?.user_metadata?.surname || "").trim()}`.trim();
  return {
    actorUserId: user.id,
    actorName: firstNonEmpty(metaName, String(user.email || ""), "Unknown User"),
    actorRole: "",
    actorSource: "auth",
  };
};

export const logActivity = async ({
  activityKey,
  actionSentence,
  actorUserId,
  actorName,
  actorRole,
  actorSource,
  sourceTable,
  sourceRecordId,
  parentTable,
  parentId,
  clientId,
  clientName,
  matterId,
  matterFileNumber,
  matterType,
  documentType,
  occurredAt,
  activityDate,
  metadata,
}: ActivityLogInput): Promise<{ ok: true } | { ok: false; error: string }> => {
  try {
    const actor = await getResolvedActivityActor();
    const resolvedActorName = firstNonEmpty(actorName, actor.actorName, "Unknown User");
    const resolvedActorUserId = firstNonEmpty(actorUserId, actor.actorUserId);
    const resolvedOccurredAt = firstNonEmpty(occurredAt, new Date().toISOString());
    const resolvedActivityDate = firstNonEmpty(activityDate, resolvedOccurredAt.slice(0, 10), new Date().toISOString().slice(0, 10));

    const { data: ruleData, error: ruleError } = await (supabase as any)
      .from("activity_score_rules")
      .select("activity_key,activity_group,activity_label,points,is_productive,active")
      .eq("activity_key", activityKey)
      .maybeSingle();
    if (ruleError) throw ruleError;

    const rule = ruleData as ActivityRule | null;
    const activityGroup = String(rule?.activity_group || "Activity").trim();
    const activityLabel = String(rule?.activity_label || activityKey).trim();
    const points = Number.isFinite(Number(rule?.points)) ? Math.max(0, Number(rule?.points)) : 0;

    const payload = {
      actor_user_id: resolvedActorUserId || null,
      actor_name: resolvedActorName,
      actor_role: firstNonEmpty(actorRole, actor.actorRole) || null,
      actor_source: firstNonEmpty(actorSource, actor.actorSource, "unknown"),
      activity_key: activityKey,
      activity_group: activityGroup,
      activity_label: activityLabel,
      action_sentence: firstNonEmpty(actionSentence, `${resolvedActorName} completed ${activityLabel.toLowerCase()} on ${formatActivityDate(resolvedOccurredAt)}`),
      points,
      source_table: firstNonEmpty(sourceTable) || null,
      source_record_id: firstNonEmpty(sourceRecordId) || null,
      parent_table: firstNonEmpty(parentTable) || null,
      parent_id: firstNonEmpty(parentId) || null,
      client_id: firstNonEmpty(clientId) || null,
      client_name: firstNonEmpty(clientName) || null,
      matter_id: firstNonEmpty(matterId) || null,
      matter_file_number: firstNonEmpty(matterFileNumber) || null,
      matter_type: firstNonEmpty(matterType) || null,
      document_type: firstNonEmpty(documentType) || null,
      occurred_at: resolvedOccurredAt,
      activity_date: resolvedActivityDate,
      metadata: metadata ?? {},
    };

    const { error } = await (supabase as any).from("activity_logs").insert(payload);
    if (error) {
      const code = String((error as any)?.code || "");
      if (code === "23505") return { ok: true };
      throw error;
    }
    return { ok: true };
  } catch (error: any) {
    const message = error?.message || "Unable to log activity.";
    console.error("Failed to log activity:", message);
    return { ok: false, error: message };
  }
};
