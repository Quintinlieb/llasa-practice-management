export interface HeaderProfileCacheValue {
  user_name: string;
  user_surname: string;
  user_email: string;
  profile_picture?: string;
}

export type CachedHeaderProfile = HeaderProfileCacheValue & {
  auth_user_id: string;
};

export const HEADER_PROFILE_STORAGE_KEY = "header:profile";

const getPersistentHeaderProfileStorageKey = (authUserId: string) => `header:profile:${authUserId}`;

const parseCachedHeaderProfile = (raw: string | null, authUserId?: string | null) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedHeaderProfile> | null;
    if (!parsed) return null;
    const cachedAuthUserId = String(parsed.auth_user_id || "").trim();
    if (!authUserId || cachedAuthUserId !== authUserId) return null;
    return {
      user_name: String(parsed.user_name || "").trim(),
      user_surname: String(parsed.user_surname || "").trim(),
      user_email: String(parsed.user_email || "").trim(),
      profile_picture: String(parsed.profile_picture || "").trim(),
    } satisfies HeaderProfileCacheValue;
  } catch {
    return null;
  }
};

export const readCachedHeaderProfile = (authUserId?: string | null) => {
  if (typeof window === "undefined" || !authUserId) return null;
  const safeAuthUserId = String(authUserId).trim();
  if (!safeAuthUserId) return null;

  try {
    const sessionProfile = parseCachedHeaderProfile(sessionStorage.getItem(HEADER_PROFILE_STORAGE_KEY), safeAuthUserId);
    if (sessionProfile) return sessionProfile;
  } catch {
    // ignore storage errors
  }

  try {
    return parseCachedHeaderProfile(localStorage.getItem(getPersistentHeaderProfileStorageKey(safeAuthUserId)), safeAuthUserId);
  } catch {
    return null;
  }
};

export const cacheHeaderProfile = (authUserId: string, nextProfile: HeaderProfileCacheValue) => {
  if (typeof window === "undefined") return;
  const safeAuthUserId = String(authUserId || "").trim();
  if (!safeAuthUserId) return;

  const payload: CachedHeaderProfile = {
    auth_user_id: safeAuthUserId,
    user_name: String(nextProfile.user_name || "").trim(),
    user_surname: String(nextProfile.user_surname || "").trim(),
    user_email: String(nextProfile.user_email || "").trim(),
    profile_picture: String(nextProfile.profile_picture || "").trim(),
  };

  try {
    sessionStorage.setItem(HEADER_PROFILE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }

  try {
    localStorage.setItem(getPersistentHeaderProfileStorageKey(safeAuthUserId), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

export const readCachedHeaderProfilePicture = (authUserId?: string | null) =>
  String(readCachedHeaderProfile(authUserId)?.profile_picture || "").trim();
