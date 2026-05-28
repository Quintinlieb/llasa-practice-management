import { supabase } from "@/integrations/supabase/client";

export const PROFILE_PICTURES_BUCKET = "profile-pictures";

const PROFILE_PICTURE_BUCKET_PREFIX = `${PROFILE_PICTURES_BUCKET}/`;

const MIME_TYPE_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const isDirectProfilePictureValue = (value: string) =>
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

export const normalizeProfilePictureStoragePath = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim().replace(/^\/+/, "");
  if (!trimmed || isDirectProfilePictureValue(trimmed)) return "";
  return trimmed.startsWith(PROFILE_PICTURE_BUCKET_PREFIX)
    ? trimmed.slice(PROFILE_PICTURE_BUCKET_PREFIX.length)
    : trimmed;
};

export const getProfilePictureStoragePath = (value: string | null | undefined) => {
  const normalizedPath = normalizeProfilePictureStoragePath(value);
  return normalizedPath || null;
};

export const resolveProfilePictureUrl = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (isDirectProfilePictureValue(trimmed)) return trimmed;
  const storagePath = normalizeProfilePictureStoragePath(trimmed);
  if (!storagePath) return "";
  const { data } = supabase.storage.from(PROFILE_PICTURES_BUCKET).getPublicUrl(storagePath);
  return String(data.publicUrl || "").trim();
};

export const buildProfilePictureStoragePath = (
  kind: "users" | "subusers",
  ownerId: string,
  file: File,
) => {
  const safeOwnerId = String(ownerId || "").trim() || "anonymous";
  const extension = getFileExtension(file);
  return `${kind}/${safeOwnerId}/${getRandomSegment()}.${extension}`;
};

export const uploadProfilePicture = async (storagePath: string, file: File) => {
  return supabase.storage.from(PROFILE_PICTURES_BUCKET).upload(storagePath, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
};

export const removeProfilePicture = async (value: string | null | undefined) => {
  const storagePath = getProfilePictureStoragePath(value);
  if (!storagePath) return;
  await supabase.storage.from(PROFILE_PICTURES_BUCKET).remove([storagePath]);
};
