import type { CrowdSignalSummary } from "@/lib/crowd-signal/model";

type DemoSignalBlueprint = {
  label: CrowdSignalSummary["label"];
  status: CrowdSignalSummary["status"];
  confidenceLabel: CrowdSignalSummary["confidenceLabel"];
  likelihood: number;
  confidence: number;
  agreement: number;
  agreementDisplay: string;
  reportCount: number;
  hoursAgo: number;
  positiveWeight: number;
  negativeWeight: number;
  explanation: string;
  freshnessNote: string;
  mixedSignal: boolean;
  sparseData: boolean;
  direction: CrowdSignalSummary["direction"];
};

const DEMO_SIGNAL_BLUEPRINTS: DemoSignalBlueprint[] = [
  {
    label: "Likely in stock",
    status: "likely_in_stock",
    confidenceLabel: "Moderate confidence",
    likelihood: 81,
    confidence: 0.75,
    agreement: 0.84,
    agreementDisplay: "11/13 recent",
    reportCount: 17,
    hoursAgo: 1,
    positiveWeight: 12.1,
    negativeWeight: 1.2,
    explanation:
      "Recent demo reports lean strongly positive, so this location reads as the best initial call.",
    freshnessNote: "Latest report about 1h ago",
    mixedSignal: false,
    sparseData: false,
    direction: "positive",
  },
  {
    label: "Likely in stock",
    status: "likely_in_stock",
    confidenceLabel: "Low-moderate confidence",
    likelihood: 67,
    confidence: 0.57,
    agreement: 0.7,
    agreementDisplay: "5/7 recent",
    reportCount: 8,
    hoursAgo: 3,
    positiveWeight: 5.9,
    negativeWeight: 1.9,
    explanation:
      "The demo signal is still positive here, but it rests on a smaller set of recent reports.",
    freshnessNote: "Latest report about 3h ago",
    mixedSignal: false,
    sparseData: false,
    direction: "positive",
  },
  {
    label: "Mixed signal",
    status: "mixed_signal",
    confidenceLabel: "Low confidence",
    likelihood: 49,
    confidence: 0.39,
    agreement: 0.5,
    agreementDisplay: "3/6 recent",
    reportCount: 6,
    hoursAgo: 7,
    positiveWeight: 3.3,
    negativeWeight: 2.8,
    explanation:
      "The demo contributors split both ways, so this store reads as a backup rather than a first call.",
    freshnessNote: "Latest report about 7h ago",
    mixedSignal: true,
    sparseData: false,
    direction: "mixed",
  },
  {
    label: "Higher fill risk",
    status: "likely_unavailable",
    confidenceLabel: "Low confidence",
    likelihood: 24,
    confidence: 0.43,
    agreement: 0.34,
    agreementDisplay: "1/3 recent",
    reportCount: 4,
    hoursAgo: 14,
    positiveWeight: 1.2,
    negativeWeight: 3.6,
    explanation:
      "The isolated demo signal trends negative here, so it is better framed as a fallback only.",
    freshnessNote: "Latest report about 14h ago",
    mixedSignal: false,
    sparseData: true,
    direction: "negative",
  },
];

export function getDemoCrowdSignalSummary(
  signalKey: string,
  index: number,
  referenceTime = Date.now(),
): CrowdSignalSummary {
  const blueprint = DEMO_SIGNAL_BLUEPRINTS[Math.min(index, DEMO_SIGNAL_BLUEPRINTS.length - 1)];

  return {
    signalKey,
    label: blueprint.label,
    status: blueprint.status,
    confidenceLabel: blueprint.confidenceLabel,
    likelihood: blueprint.likelihood,
    confidence: blueprint.confidence,
    agreement: blueprint.agreement,
    agreementDisplay: blueprint.agreementDisplay,
    reportCount: blueprint.reportCount,
    lastReportedAt: new Date(referenceTime - blueprint.hoursAgo * 60 * 60 * 1000),
    positiveWeight: blueprint.positiveWeight,
    negativeWeight: blueprint.negativeWeight,
    explanation: blueprint.explanation,
    freshnessNote: blueprint.freshnessNote,
    mixedSignal: blueprint.mixedSignal,
    sparseData: blueprint.sparseData,
    stale: false,
    direction: blueprint.direction,
  };
}
