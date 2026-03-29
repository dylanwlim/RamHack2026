import {
  CROWD_REPORT_TYPES,
  type CrowdReportRecord,
  type CrowdSignalSummary,
} from "@/lib/crowd-signal/model";

const REPORT_TYPE_INDEX = Object.fromEntries(
  CROWD_REPORT_TYPES.map((type) => [type.id, type]),
) as Record<(typeof CROWD_REPORT_TYPES)[number]["id"], (typeof CROWD_REPORT_TYPES)[number]>;

const REPORT_HALF_LIFE_HOURS = 96;
const CONFIDENCE_PRIOR_WEIGHT = 2.2;
const EVIDENCE_SCALE = 2.6;
const STALE_REPORT_HOURS = 240;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, decimals = 3) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function reportSupport(reportSignal: number) {
  return clamp((reportSignal + 1.1) / 2.2, 0, 1);
}

export function computeTrustWeight(contributionCount: number) {
  const safeCount = Math.max(0, contributionCount);
  const weight = 0.06 + 0.72 * (1 - Math.exp(-safeCount / 18));
  return roundTo(clamp(weight, 0.06, 0.78));
}

export function getTrustTier(contributionCount: number) {
  if (contributionCount >= 25) {
    return {
      label: "Established contributor",
      shortLabel: "Established",
    };
  }

  if (contributionCount >= 10) {
    return {
      label: "Trusted contributor",
      shortLabel: "Trusted",
    };
  }

  if (contributionCount >= 3) {
    return {
      label: "Building contributor",
      shortLabel: "Building",
    };
  }

  return {
    label: "Emerging contributor",
    shortLabel: "Emerging",
  };
}

export function normalizeMedicationKey(query: string) {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/%.\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractStrengthDescriptor(query: string) {
  const match = query.match(/(\d+(?:\.\d+)?)\s?(mg|mcg|g|ml|iu|units?|%)/i);
  return match ? `${match[1]} ${match[2].toLowerCase()}` : null;
}

export function extractFormulationDescriptor(query: string) {
  const lower = query.toLowerCase();
  const tokens = [
    "xr",
    "er",
    "ir",
    "xl",
    "tablet",
    "capsule",
    "solution",
    "suspension",
    "injection",
    "pen",
    "patch",
  ];

  const match = tokens.find((token) => lower.includes(token));
  return match ? match.toUpperCase() : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildPharmacyKey({
  placeId,
  pharmacyName,
  pharmacyAddress,
}: {
  placeId?: string | null;
  pharmacyName: string;
  pharmacyAddress: string;
}) {
  return placeId?.trim() || slugify(`${pharmacyName}-${pharmacyAddress}`);
}

export function buildSignalKey({
  medicationQuery,
  placeId,
  pharmacyName,
  pharmacyAddress,
}: {
  medicationQuery: string;
  placeId?: string | null;
  pharmacyName: string;
  pharmacyAddress: string;
}) {
  return `${buildPharmacyKey({ placeId, pharmacyName, pharmacyAddress })}::${normalizeMedicationKey(
    medicationQuery,
  )}`;
}

function hoursSince(date: Date | null) {
  if (!date) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60));
}

function formatFreshnessNote(date: Date | null) {
  if (!date) {
    return "No recent reports yet";
  }

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) {
    return `Latest report ${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Latest report ${diffDays}d ago`;
}

function formatAgreementDisplay({
  reportCount,
  positiveReportCount,
  negativeReportCount,
  agreement,
  sparseData,
  stale,
}: {
  reportCount: number;
  positiveReportCount: number;
  negativeReportCount: number;
  agreement: number;
  sparseData: boolean;
  stale: boolean;
}) {
  if (!reportCount) {
    return "No data";
  }

  const ageLabel = stale ? "older reports" : "recent";

  if (reportCount === 1) {
    return stale ? "1/1 older report" : "1/1 recent";
  }

  if (reportCount === 2) {
    return positiveReportCount === 1 && negativeReportCount === 1
      ? stale
        ? "1/2 split, older"
        : "1/2 split"
      : `2/2 ${ageLabel}`;
  }

  const dominantCount = Math.max(positiveReportCount, negativeReportCount);

  if (sparseData) {
    return `${dominantCount}/${reportCount} ${ageLabel}`;
  }

  return stale ? `${Math.round(agreement * 100)}% older` : `${Math.round(agreement * 100)}%`;
}

function buildEarlySignalExplanation(
  direction: "positive" | "negative" | "mixed" | "none",
  reportCount: number,
) {
  if (direction === "positive") {
    return reportCount === 1
      ? "One recent affirmative report leans positive, but a single report is not enough to assume inventory is still there."
      : "A small number of recent reports lean positive, but the sample is still too thin to treat as reliable availability.";
  }

  if (direction === "negative") {
    return reportCount === 1
      ? "One recent negative report raises concern, but a single report is not enough to treat this pharmacy as definitively out of stock."
      : "A small number of recent reports lean negative, but the sample is still too thin to treat as reliable unavailability.";
  }

  return "Only a small number of recent reports exist, and they are not consistent enough to support a stronger crowd conclusion.";
}

export function computeCrowdSignal(
  signalKey: string,
  reports: CrowdReportRecord[],
): CrowdSignalSummary {
  if (!reports.length) {
    return {
      signalKey,
      label: "Not enough crowd data",
      status: "not_enough_data",
      confidenceLabel: "Low confidence",
      likelihood: 50,
      confidence: 0,
      agreement: 0,
      agreementDisplay: "No data",
      reportCount: 0,
      lastReportedAt: null,
      positiveWeight: 0,
      negativeWeight: 0,
      explanation: "No contributor reports have been submitted for this pharmacy and medication yet.",
      freshnessNote: "No recent reports yet",
      mixedSignal: false,
      sparseData: true,
      stale: false,
      direction: "none",
    };
  }

  const sortedReports = [...reports].sort((left, right) => {
    const leftTime = left.createdAt?.getTime() || 0;
    const rightTime = right.createdAt?.getTime() || 0;
    return rightTime - leftTime;
  });

  let positiveWeight = 0;
  let negativeWeight = 0;
  let totalWeight = 0;
  let weightedFreshness = 0;
  let positiveReportCount = 0;
  let negativeReportCount = 0;

  sortedReports.forEach((report) => {
    const reportType = REPORT_TYPE_INDEX[report.reportType];
    if (!reportType) {
      return;
    }

    const freshnessWeight = 0.5 ** (hoursSince(report.createdAt) / REPORT_HALF_LIFE_HOURS);
    const contributorWeight = 0.45 + computeTrustWeight(report.reporterContributionCount);
    const baseWeight = reportType.reliability * freshnessWeight * contributorWeight;
    const positiveShare = reportSupport(reportType.signal);

    positiveWeight += baseWeight * positiveShare;
    negativeWeight += baseWeight * (1 - positiveShare);
    totalWeight += baseWeight;
    weightedFreshness += baseWeight * freshnessWeight;

    if (reportType.signal > 0) {
      positiveReportCount += 1;
    } else if (reportType.signal < 0) {
      negativeReportCount += 1;
    }
  });

  const posteriorPositive = CONFIDENCE_PRIOR_WEIGHT + positiveWeight;
  const posteriorNegative = CONFIDENCE_PRIOR_WEIGHT + negativeWeight;
  const likelihood = Math.round((posteriorPositive / (posteriorPositive + posteriorNegative)) * 100);
  const dominantWeight = Math.max(positiveWeight, negativeWeight);
  const minorityWeight = Math.min(positiveWeight, negativeWeight);
  const consistency = totalWeight > 0 ? clamp((dominantWeight - minorityWeight) / totalWeight, 0, 1) : 0;
  const sampleAdequacy = 1 - Math.exp(-totalWeight / EVIDENCE_SCALE);
  const freshestAgeHours = hoursSince(sortedReports[0]?.createdAt || null);
  const recencyCoverage = totalWeight > 0 ? clamp(weightedFreshness / totalWeight, 0, 1) : 0;
  const agreement = clamp(consistency * sampleAdequacy, 0, 1);
  const confidence = clamp(
    sampleAdequacy * (0.42 + consistency * 0.33 + recencyCoverage * 0.25),
    0,
    1,
  );
  const sparseData = reports.length < 3 || sampleAdequacy < 0.45;
  const stale = freshestAgeHours > STALE_REPORT_HOURS || recencyCoverage < 0.28;
  const direction: CrowdSignalSummary["direction"] =
    likelihood >= 55
      ? "positive"
      : likelihood <= 45
        ? "negative"
        : reports.length
          ? "mixed"
          : "none";
  const mixedSignal =
    !sparseData && (consistency < 0.35 || confidence < 0.42 || (likelihood > 45 && likelihood < 55));

  let status: CrowdSignalSummary["status"] = "mixed_signal";
  let label = "Mixed signal";
  let explanation = "Recent contributor reports are split, so the crowd signal should be treated cautiously.";

  if (stale && confidence < 0.72) {
    status = "not_enough_data";
    label = "Stale crowd signal";
    explanation =
      "Reports exist for this pharmacy, but the freshest check is old enough that the signal should be treated as outdated until a newer confirmation comes in.";
  } else if (sparseData) {
    status = "not_enough_data";
    label =
      direction === "positive"
        ? "Early positive signal"
        : direction === "negative"
          ? "Early negative signal"
          : "Not enough crowd data";
    explanation = buildEarlySignalExplanation(direction, reports.length);
  } else if (mixedSignal) {
    status = "mixed_signal";
    label = "Mixed signal";
    explanation =
      "Fresh or higher-trust reports disagree with one another, so the crowd signal is directional at best and should be treated cautiously.";
  } else if (direction === "positive" && likelihood >= 60) {
    status = "likely_in_stock";
    label = "Likely in stock";
    explanation =
      "Recent weighted reports lean positive for this pharmacy and medication, but direct confirmation is still recommended before sending someone there.";
  } else if (direction === "negative" && likelihood <= 40) {
    status = "likely_unavailable";
    label = "Higher fill risk";
    explanation =
      "Recent weighted reports lean negative for this pharmacy and medication, so the app is flagging a higher risk of an unsuccessful fill.";
  }

  const confidenceLabel = sparseData
    ? "Low sample confidence"
    : stale && confidence < 0.75
      ? "Stale confidence"
      : confidence >= 0.75
        ? "High confidence"
        : confidence >= 0.45
          ? "Medium confidence"
          : "Low confidence";

  return {
    signalKey,
    label,
    status,
    confidenceLabel,
    likelihood,
    confidence: roundTo(confidence, 3),
    agreement: roundTo(agreement, 3),
    agreementDisplay: formatAgreementDisplay({
      reportCount: reports.length,
      positiveReportCount,
      negativeReportCount,
      agreement,
      sparseData,
      stale,
    }),
    reportCount: reports.length,
    lastReportedAt: sortedReports[0]?.createdAt || null,
    positiveWeight: roundTo(positiveWeight, 3),
    negativeWeight: roundTo(negativeWeight, 3),
    explanation,
    freshnessNote: formatFreshnessNote(sortedReports[0]?.createdAt || null),
    mixedSignal,
    sparseData,
    stale,
    direction,
  };
}

export function buildCrowdSignalMap(reports: CrowdReportRecord[]) {
  const grouped = new Map<string, CrowdReportRecord[]>();

  reports.forEach((report) => {
    const existing = grouped.get(report.signalKey) || [];
    existing.push(report);
    grouped.set(report.signalKey, existing);
  });

  return Object.fromEntries(
    Array.from(grouped.entries()).map(([signalKey, signalReports]) => [
      signalKey,
      computeCrowdSignal(signalKey, signalReports),
    ]),
  ) as Record<string, CrowdSignalSummary>;
}
