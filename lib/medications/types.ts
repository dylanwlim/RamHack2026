export type MedicationWorkflowCategory =
  | "controlled_stimulant"
  | "acute_antibiotic"
  | "cold_chain"
  | "maintenance_refill";

export type MedicationBadge = "Rx" | "OTC" | "Rx/OTC" | null;
export type MedicationSource = "openfda" | "demo";

export type MedicationIngredient = {
  name: string;
  strength: string | null;
};

export type MedicationStrengthOption = {
  id: string;
  label: string;
  value: string;
  amount: number | null;
  unit: string | null;
};

export type MedicationIndexRecord = {
  id: string;
  displayLabel: string;
  description: string;
  badge: MedicationBadge;
  brandName: string | null;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  route: string | null;
  activeIngredients: MedicationIngredient[];
  aliases: string[];
  ndcProductCodes: string[];
  productCount: number;
  packageCount: number;
  labelerCount: number;
  marketingCategories: string[];
  productTypes: string[];
  workflowCategory: MedicationWorkflowCategory;
};

export type MedicationIndexSnapshot = {
  generatedAt: string;
  source: {
    name: "openFDA NDC";
    bulkUrl: string;
    datasetLastUpdated: string | null;
  };
  counts: {
    processed: number;
    included: number;
    canonical: number;
  };
  featuredMedicationIds: string[];
  records: MedicationIndexRecord[];
};

export type MedicationSearchOption = {
  id: string;
  label: string;
  value: string;
  description: string;
  badge?: string;
  source: MedicationSource;
  canonicalName: string;
  canonicalLabel: string;
  queryBaseLabel: string;
  queryDosageForm: string | null;
  formulation: string | null;
  formulationShortLabel: string | null;
  dosageForm: string | null;
  route: string | null;
  strengths: MedicationStrengthOption[];
  matchedStrength?: string | null;
  workflowCategory: MedicationWorkflowCategory;
  demoOnly?: boolean;
  demoNote?: string | null;
  simulatedUserCount?: number | null;
};

export type MedicationSearchResponse = {
  status: "ok";
  query: string;
  exact: boolean;
  results: MedicationSearchOption[];
  dataFreshness: {
    generatedAt: string;
    datasetLastUpdated: string | null;
  };
};
