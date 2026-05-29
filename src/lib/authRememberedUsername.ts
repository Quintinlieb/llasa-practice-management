const REMEMBERED_USERNAME_KEY = "nudoc.rememberedUsername";

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
      return;
    }
    window.localStorage.setItem(REMEMBERED_USERNAME_KEY, normalized);
  } catch {
    // Ignore storage write failures.
  }
};

export const clearRememberedUsername = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
  } catch {
    // Ignore storage remove failures.
  }
};
