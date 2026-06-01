export type StoredMinimizedDocumentTab = {
  id: string;
  documentKey: string;
  label: string;
  instanceNumber?: number;
  minimizedOrder?: number;
  draftState?: unknown;
};

export const minimizedDocumentTabsStorageKey = "documents:minimized-tabs";
export const minimizedDocumentTabsChangedEvent = "documents-minimized-tabs-changed";
const documentKeyAliases: Record<string, string> = {
  disciplinaryHearingNotice: "hearingNotice",
};

const normalizeMinimizedDocumentTabs = (tabs: StoredMinimizedDocumentTab[]) => {
  const seenByDocumentKey = new Map<string, number>();

  return tabs.map((tab, index) => {
    const normalizedDocumentKey = documentKeyAliases[tab.documentKey] || tab.documentKey;
    const seenCount = seenByDocumentKey.get(normalizedDocumentKey) ?? 0;
    seenByDocumentKey.set(normalizedDocumentKey, seenCount + 1);

    return {
      ...tab,
      documentKey: normalizedDocumentKey,
      minimizedOrder:
        typeof tab.minimizedOrder === "number" && Number.isFinite(tab.minimizedOrder) ? tab.minimizedOrder : index,
      instanceNumber:
        typeof tab.instanceNumber === "number" && Number.isFinite(tab.instanceNumber)
          ? tab.instanceNumber
          : seenCount + 1,
    } satisfies StoredMinimizedDocumentTab;
  });
};

export const loadMinimizedDocumentTabs = (): StoredMinimizedDocumentTab[] => {
  try {
    const raw = sessionStorage.getItem(minimizedDocumentTabsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeMinimizedDocumentTabs(parsed.filter(
      (item): item is StoredMinimizedDocumentTab =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as StoredMinimizedDocumentTab).id === "string" &&
        typeof (item as StoredMinimizedDocumentTab).documentKey === "string" &&
        typeof (item as StoredMinimizedDocumentTab).label === "string",
    ));
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
