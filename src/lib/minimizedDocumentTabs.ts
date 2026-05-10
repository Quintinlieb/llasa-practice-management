export type StoredMinimizedDocumentTab = {
  id: string;
  documentKey: string;
  label: string;
  draftState?: unknown;
};

export const minimizedDocumentTabsStorageKey = "documents:minimized-tabs";
export const minimizedDocumentTabsChangedEvent = "documents-minimized-tabs-changed";

export const loadMinimizedDocumentTabs = (): StoredMinimizedDocumentTab[] => {
  try {
    const raw = sessionStorage.getItem(minimizedDocumentTabsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredMinimizedDocumentTab =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as StoredMinimizedDocumentTab).id === "string" &&
        typeof (item as StoredMinimizedDocumentTab).documentKey === "string" &&
        typeof (item as StoredMinimizedDocumentTab).label === "string",
    );
  } catch {
    return [];
  }
};

export const saveMinimizedDocumentTabs = (tabs: StoredMinimizedDocumentTab[]) => {
  try {
    if (tabs.length === 0) {
      sessionStorage.removeItem(minimizedDocumentTabsStorageKey);
    } else {
      sessionStorage.setItem(minimizedDocumentTabsStorageKey, JSON.stringify(tabs));
    }
  } catch {
    // ignore storage errors
  }

  window.dispatchEvent(new CustomEvent(minimizedDocumentTabsChangedEvent));
};
