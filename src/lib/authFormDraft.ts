export type AuthFormDraft = {
  isLogin: boolean;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: "trial" | "domestic" | "business" | null;
  acceptedTerms: boolean;
};

const AUTH_FORM_DRAFT_KEY = "nudoc.authFormDraft";

export const readAuthFormDraft = (): AuthFormDraft | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_FORM_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthFormDraft;
  } catch {
    return null;
  }
};

export const writeAuthFormDraft = (draft: AuthFormDraft): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTH_FORM_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage write failures (private mode, blocked access, etc).
  }
};

export const clearAuthFormDraft = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(AUTH_FORM_DRAFT_KEY);
  } catch {
    // Ignore storage remove failures (private mode, blocked access, etc).
  }
};
