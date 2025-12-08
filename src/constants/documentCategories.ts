export type DocumentCategory = {
  slug: string;
  label: string;
  path: string;
};

export const documentCategories: DocumentCategory[] = [
  { slug: "discipline", label: "Discipline", path: "/documents/discipline" },
  { slug: "contracts", label: "Contracts", path: "/documents/contracts" },
  { slug: "performance", label: "Performance", path: "/documents/performance" },
  { slug: "notices", label: "Notices", path: "/documents/notices" },
];
