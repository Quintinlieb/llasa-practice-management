import { supabase } from "@/integrations/supabase/client";

export const USER_SIGNATURES_BUCKET = "user-signatures";

const USER_SIGNATURES_BUCKET_PREFIX = `${USER_SIGNATURES_BUCKET}/`;

const MIME_TYPE_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const isDirectSignatureValue = (value: string) =>
  /^(?:data:|blob:|https?:\/\/)/i.test(value);

const getFileExtension = (file: File) => {
  const fileName = String(file.name || "").trim();
  const nameParts = fileName.split(".");
  const fromName = nameParts.length > 1 ? String(nameParts.pop() || "").trim().toLowerCase() : "";
  if (fromName) return fromName.replace(/[^a-z0-9]/g, "") || "bin";
  return MIME_TYPE_EXTENSION_MAP[String(file.type || "").trim().toLowerCase()] || "bin";
};

const getRandomSegment = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const normalizeUserSignatureStoragePath = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim().replace(/^\/+/, "");
  if (!trimmed || isDirectSignatureValue(trimmed)) return "";
  return trimmed.startsWith(USER_SIGNATURES_BUCKET_PREFIX)
    ? trimmed.slice(USER_SIGNATURES_BUCKET_PREFIX.length)
    : trimmed;
};

export const getUserSignatureStoragePath = (value: string | null | undefined) => {
  const normalizedPath = normalizeUserSignatureStoragePath(value);
  return normalizedPath || null;
};

export const resolveUserSignatureUrl = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (isDirectSignatureValue(trimmed)) return trimmed;
  const storagePath = normalizeUserSignatureStoragePath(trimmed);
  if (!storagePath) return "";
  const { data } = supabase.storage.from(USER_SIGNATURES_BUCKET).getPublicUrl(storagePath);
  return String(data.publicUrl || "").trim();
};

export const fetchCurrentUserSignatureUrl = async (authUserId: string) => {
  const userId = String(authUserId || "").trim();
  if (!userId) return "";

  const { data: profileData } = await (supabase as any)
    .from("profiles")
    .select("signature_storage_path")
    .eq("id", userId)
    .maybeSingle();
  const profileSignature = resolveUserSignatureUrl((profileData as any)?.signature_storage_path);
  if (profileSignature) return profileSignature;

  const { data: subuserData } = await (supabase as any)
    .from("subusers")
    .select("signature_storage_path")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return resolveUserSignatureUrl((subuserData as any)?.signature_storage_path);
};

export const buildUserSignatureStoragePath = (
  kind: "users" | "subusers",
  ownerId: string,
  file: File,
) => {
  const safeOwnerId = String(ownerId || "").trim() || "anonymous";
  const extension = getFileExtension(file);
  return `${kind}/${safeOwnerId}/${getRandomSegment()}.${extension}`;
};

export const uploadUserSignature = async (storagePath: string, file: File) => {
  return supabase.storage.from(USER_SIGNATURES_BUCKET).upload(storagePath, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
};

export const removeUserSignature = async (value: string | null | undefined) => {
  const storagePath = getUserSignatureStoragePath(value);
  if (!storagePath) return;
  await supabase.storage.from(USER_SIGNATURES_BUCKET).remove([storagePath]);
};
