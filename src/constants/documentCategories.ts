export type DocumentCategory = {
  slug: string;
  label: string;
  path: string;
};

export const documentCategories: DocumentCategory[] = [
  { slug: "discipline", label: "Discipline", path: "/documents/discipline" },
  { slug: "performance", label: "Performance", path: "/documents/performance" },
  { slug: "contracts", label: "Contracts", path: "/documents/contracts" },
];
