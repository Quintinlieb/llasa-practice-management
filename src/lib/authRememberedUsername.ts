const REMEMBERED_USERNAME_KEY = "llasa.rememberedUsername";
const REMEMBERED_USERNAME_ENABLED_KEY = "llasa.rememberedUsernameEnabled";

export const readRememberedUsername = (): string => {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(REMEMBERED_USERNAME_KEY) || "").trim();
  } catch {
    return "";
  }
};

export const writeRememberedUsername = (username: string): void => {
  if (typeof window === "undefined") return;
  try {
    const normalized = username.trim();
    if (!normalized) {
      window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
      window.localStorage.setItem(REMEMBERED_USERNAME_ENABLED_KEY, "false");
      return;
    }
    window.localStorage.setItem(REMEMBERED_USERNAME_KEY, normalized);
    window.localStorage.setItem(REMEMBERED_USERNAME_ENABLED_KEY, "true");
  } catch {
    // Ignore storage write failures.
  }
};

export const readRememberedUsernameEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const stored = String(window.localStorage.getItem(REMEMBERED_USERNAME_ENABLED_KEY) || "").trim().toLowerCase();
    if (stored === "true") return true;
    if (stored === "false") return false;
    return readRememberedUsername().length > 0;
  } catch {
    return false;
  }
};

export const writeRememberedUsernameEnabled = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBERED_USERNAME_ENABLED_KEY, enabled ? "true" : "false");
    if (!enabled) {
      window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }
  } catch {
    // Ignore storage write failures.
  }
};

export const clearRememberedUsername = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    window.localStorage.setItem(REMEMBERED_USERNAME_ENABLED_KEY, "false");
  } catch {
    // Ignore storage remove failures.
  }
};
