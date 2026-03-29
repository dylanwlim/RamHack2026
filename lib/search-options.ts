export type SearchOption = {
  id: string;
  label: string;
  value: string;
  description: string;
  keywords?: string[];
  badge?: string;
};

export type SearchScenario = {
  id: string;
  label: string;
  medicationId: string;
  locationId: string;
  description: string;
};

export const medicationOptions: SearchOption[] = [
  {
    id: "adderall-xr-20mg",
    label: "Adderall XR 20 mg",
    value: "Adderall XR 20 mg",
    description: "Controlled stimulant",
    keywords: ["adderall", "amphetamine", "xr", "20 mg", "controlled"],
  },
  {
    id: "vyvanse-30mg",
    label: "Vyvanse 30 mg",
    value: "Vyvanse 30 mg",
    description: "Controlled stimulant",
    keywords: ["vyvanse", "lisdexamfetamine", "30 mg", "controlled"],
  },
  {
    id: "concerta-18mg",
    label: "Concerta 18 mg",
    value: "Concerta 18 mg",
    description: "Controlled stimulant",
    keywords: ["concerta", "methylphenidate", "18 mg", "controlled"],
  },
  {
    id: "wegovy",
    label: "Wegovy",
    value: "Wegovy",
    description: "GLP-1 refill",
    keywords: ["wegovy", "semaglutide", "glp-1"],
  },
  {
    id: "ozempic",
    label: "Ozempic",
    value: "Ozempic",
    description: "GLP-1 refill",
    keywords: ["ozempic", "semaglutide", "glp-1"],
  },
  {
    id: "amoxicillin-500mg",
    label: "Amoxicillin 500 mg",
    value: "Amoxicillin 500 mg",
    description: "Same-day antibiotic",
    keywords: ["amoxicillin", "500 mg", "antibiotic", "acute"],
  },
  {
    id: "azithromycin-250mg",
    label: "Azithromycin 250 mg",
    value: "Azithromycin 250 mg",
    description: "Same-day antibiotic",
    keywords: ["azithromycin", "250 mg", "antibiotic", "acute"],
  },
  {
    id: "sertraline-50mg",
    label: "Sertraline 50 mg",
    value: "Sertraline 50 mg",
    description: "Routine refill",
    keywords: ["sertraline", "50 mg", "routine", "refill"],
  },
];

export const locationOptions: SearchOption[] = [
  {
    id: "brooklyn-ny",
    label: "Brooklyn, NY",
    value: "Brooklyn, NY",
    description: "City + state",
    keywords: ["brooklyn", "new york", "nyc"],
  },
  {
    id: "brooklyn-11201",
    label: "Brooklyn, NY 11201",
    value: "Brooklyn, NY 11201",
    description: "ZIP-backed entry",
    keywords: ["11201", "downtown brooklyn", "brooklyn zip"],
    badge: "ZIP",
  },
  {
    id: "queens-ny",
    label: "Queens, NY",
    value: "Queens, NY",
    description: "City + state",
    keywords: ["queens", "new york", "nyc"],
  },
  {
    id: "queens-11375",
    label: "Queens, NY 11375",
    value: "Queens, NY 11375",
    description: "ZIP-backed entry",
    keywords: ["11375", "forest hills", "queens zip"],
    badge: "ZIP",
  },
  {
    id: "lower-manhattan-ny",
    label: "Lower Manhattan, NY",
    value: "Lower Manhattan, NY",
    description: "Neighborhood + city",
    keywords: ["lower manhattan", "manhattan", "nyc", "tribeca", "soho"],
  },
  {
    id: "lower-manhattan-10013",
    label: "Lower Manhattan, NY 10013",
    value: "Lower Manhattan, NY 10013",
    description: "ZIP-backed entry",
    keywords: ["10013", "tribeca", "soho", "lower manhattan zip"],
    badge: "ZIP",
  },
  {
    id: "hoboken-nj",
    label: "Hoboken, NJ",
    value: "Hoboken, NJ",
    description: "City + state",
    keywords: ["hoboken", "new jersey", "nj"],
  },
  {
    id: "hoboken-07030",
    label: "Hoboken, NJ 07030",
    value: "Hoboken, NJ 07030",
    description: "ZIP-backed entry",
    keywords: ["07030", "hoboken zip", "new jersey"],
    badge: "ZIP",
  },
  {
    id: "jersey-city-nj",
    label: "Jersey City, NJ",
    value: "Jersey City, NJ",
    description: "City + state",
    keywords: ["jersey city", "new jersey", "nj"],
  },
  {
    id: "jersey-city-07302",
    label: "Jersey City, NJ 07302",
    value: "Jersey City, NJ 07302",
    description: "ZIP-backed entry",
    keywords: ["07302", "jersey city zip", "new jersey"],
    badge: "ZIP",
  },
];

export const searchScenarios: SearchScenario[] = [
  {
    id: "controlled-stimulant",
    label: "Controlled stimulant",
    medicationId: "adderall-xr-20mg",
    locationId: "brooklyn-ny",
    description:
      "A higher-friction handoff where the nearby list stays live and the medication context stays explicit.",
  },
  {
    id: "glp-1-refill",
    label: "GLP-1 refill",
    medicationId: "wegovy",
    locationId: "queens-ny",
    description:
      "Useful for shipment-sensitive questions without implying a specific dose is on the shelf.",
  },
  {
    id: "same-day-antibiotic",
    label: "Same-day antibiotic",
    medicationId: "amoxicillin-500mg",
    locationId: "hoboken-nj",
    description:
      "A speed-sensitive path where open status and short travel time matter more than a perfect score.",
  },
  {
    id: "routine-refill",
    label: "Routine refill",
    medicationId: "sertraline-50mg",
    locationId: "lower-manhattan-ny",
    description:
      "A steadier refill flow that still keeps transfer timing and confirmation separate from inventory claims.",
  },
];

export function normalizeSearchOptionText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugifyValue(value: string) {
  return normalizeSearchOptionText(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function findSupportedOption(options: readonly SearchOption[], value: string) {
  const normalizedValue = normalizeSearchOptionText(value);

  if (!normalizedValue) {
    return null;
  }

  return (
    options.find((option) => {
      const haystack = [option.label, option.value];
      return haystack.some((entry) => normalizeSearchOptionText(entry) === normalizedValue);
    }) || null
  );
}

export function resolveInitialOption(options: readonly SearchOption[], value: string) {
  const exactOption = findSupportedOption(options, value);

  if (exactOption) {
    return exactOption;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  return {
    id: `existing-${slugifyValue(trimmedValue)}`,
    label: trimmedValue,
    value: trimmedValue,
    description: "Existing search value",
  } satisfies SearchOption;
}
