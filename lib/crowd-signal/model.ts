export const CROWD_REPORT_TYPES = [
  {
    id: "in_stock",
    label: "In stock",
    description: "Staff or shelf check indicated the medication was available.",
    signal: 1,
    reliability: 1,
  },
  {
    id: "low_stock_uncertain",
    label: "Low stock / uncertain",
    description: "The store may have limited supply or was unsure during the check.",
    signal: 0.2,
    reliability: 0.7,
  },
  {
    id: "out_of_stock",
    label: "Out of stock",
    description: "The pharmacy said the medication was not currently available.",
    signal: -1,
    reliability: 1,
  },
  {
    id: "successfully_filled",
    label: "Successfully filled",
    description: "A real fill was completed recently at this location.",
    signal: 1.15,
    reliability: 1.1,
  },
  {
    id: "could_not_fill",
    label: "Pharmacy could not fill",
    description: "The store could not complete the fill attempt.",
    signal: -1.1,
    reliability: 1.05,
  },
  {
    id: "called_and_confirmed",
    label: "Called and confirmed",
    description: "A staff call suggested likely availability, but without a completed fill.",
    signal: 0.8,
    reliability: 0.9,
  },
] as const;

export type CrowdReportType = (typeof CROWD_REPORT_TYPES)[number]["id"];

export type CrowdReportRecord = {
  id: string;
  signalKey: string;
  medicationKey: string;
  pharmacyKey: string;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPlaceId: string | null;
  googleMapsUrl: string | null;
  medicationQuery: string;
  strengthDescriptor: string | null;
  formulationDescriptor: string | null;
  reportType: CrowdReportType;
  note: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  userId: string;
  reporterDisplayName: string;
  publicAliasSnapshot: string;
  reporterContributionCount: number;
  reporterTrustWeight?: number | null;
};

export type CrowdSignalSummary = {
  signalKey: string;
  label: string;
  status:
    | "likely_in_stock"
    | "mixed_signal"
    | "likely_unavailable"
    | "not_enough_data";
  confidenceLabel: string;
  likelihood: number;
  confidence: number;
  agreement: number;
  agreementDisplay: string;
  reportCount: number;
  lastReportedAt: Date | null;
  positiveWeight: number;
  negativeWeight: number;
  explanation: string;
  freshnessNote: string;
  mixedSignal: boolean;
  sparseData: boolean;
  stale: boolean;
  direction: "positive" | "negative" | "mixed" | "none";
};
