"use strict";

const HIGHER_FRICTION = "higher-friction";
const MIXED = "mixed";
const STEADIER = "steadier";
const RECENT_RECALL_WINDOW_DAYS = 730;
const MAX_MATCHES = 6;
const PRESERVE_UPPERCASE_TOKENS = new Set(["XR", "ER", "IR", "XL", "SR", "ODT"]);

const UNAVAILABLE_DATA = [
  "Local pharmacy shelf inventory",
  "Store-by-store wholesaler allocations",
  "Patient-specific insurance coverage or copay",
  "Real-time transfer success between pharmacies",
];

const MONTH_INDEX = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value) {
  return sanitizeText(value).toLowerCase();
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      values
        .map((value) => sanitizeText(value))
        .filter(Boolean),
    ),
  );
}

function titleCase(value) {
  return sanitizeText(value)
    .split(/\s+/)
    .map((token) => {
      return token
        .split("-")
        .map((segment) => {
          const upperToken = segment.toUpperCase();
          if (PRESERVE_UPPERCASE_TOKENS.has(upperToken)) {
            return upperToken;
          }

          if (/^[A-Z]{1,3}$/.test(segment)) {
            return segment.toUpperCase();
          }

          return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
        })
        .join("-");
    })
    .join(" ");
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseDate(value) {
  const raw = sanitizeText(value);

  if (!raw) {
    return null;
  }

  if (/^\d{8}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    return new Date(Date.UTC(year, month, day));
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [month, day, year] = raw.split("/").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  if (/^\d{2}-[A-Z]{3}-\d{2}$/i.test(raw)) {
    const [day, monthToken, yearToken] = raw.toUpperCase().split("-");
    const monthIndex = MONTH_INDEX[monthToken];
    const year = 2000 + Number(yearToken);
    return Number.isInteger(monthIndex)
      ? new Date(Date.UTC(year, monthIndex, Number(day)))
      : null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function formatDisplayDate(value) {
  const parsed = value instanceof Date ? value : parseDate(value);
  if (!parsed) {
    return "Unavailable";
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatIsoDate(value) {
  const parsed = value instanceof Date ? value : parseDate(value);
  if (!parsed) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function isCurrentListing(record, referenceDate) {
  const expiry = parseDate(record.listing_expiration_date);
  return Boolean(expiry && expiry >= referenceDate);
}

function getRelativeDaysAgo(value, referenceDate) {
  const parsed = parseDate(value);
  if (!parsed) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((referenceDate - parsed) / (1000 * 60 * 60 * 24));
}

function normalizeStrength(value) {
  return sanitizeText(value)
    .replace(/\s*\(([^)]*)\)\s*$/, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/(\d)(mg|mcg|g|ml|iu|units?|%)/gi, (match, amount, unit) => `${amount} ${unit.toLowerCase()}`)
    .replace(/(^|[\/\s])\.(\d)/g, (match, prefix, decimal) => `${prefix}0.${decimal}`)
    .replace(/\/1$/g, "");
}

function numericStrengthValue(value) {
  const match = sanitizeText(value).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function formatNumericStrength(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function summarizeStrengthsFromIngredients(ingredients = []) {
  const normalizedStrengths = ingredients
    .map((ingredient) => normalizeStrength(ingredient?.strength))
    .filter(Boolean);

  if (normalizedStrengths.length <= 1) {
    return normalizedStrengths;
  }

  const parsed = normalizedStrengths.map((strength) => {
    const match = strength.match(/^(\d+(?:\.\d+)?)\s*([a-z%]+)$/i);
    if (!match) {
      return null;
    }

    return {
      amount: Number(match[1]),
      unit: match[2].toLowerCase(),
    };
  });

  if (
    parsed.some((item) => !item) ||
    new Set(parsed.map((item) => item.unit)).size !== 1
  ) {
    return normalizedStrengths;
  }

  const totalAmount = parsed.reduce((sum, item) => sum + item.amount, 0);
  return [`${formatNumericStrength(totalAmount)} ${parsed[0].unit}`];
}

function sortStrengths(values) {
  return uniqueStrings(values).sort((left, right) => {
    const leftValue = numericStrengthValue(left);
    const rightValue = numericStrengthValue(right);
    return leftValue - rightValue || left.localeCompare(right);
  });
}

function shortDosageForm(value) {
  const normalized = normalizeText(value);

  if (normalized.includes("tablet")) {
    return "Tablet";
  }

  if (normalized.includes("capsule")) {
    return "Capsule";
  }

  if (normalized.includes("solution") || normalized.includes("injection")) {
    return "Injection";
  }

  if (normalized.includes("suspension")) {
    return "Suspension";
  }

  return titleCase(value);
}

function shortRoute(value) {
  const normalized = normalizeText(value);

  if (normalized.includes("subcutaneous")) {
    return "Subcutaneous";
  }

  if (normalized.includes("oral")) {
    return "Oral";
  }

  if (normalized.includes("intravenous")) {
    return "Intravenous";
  }

  return titleCase(value);
}

function simplifyBrandName(value) {
  return sanitizeText(value)
    .replace(/\s+\d+(?:\.\d+)?(?:mg|mcg|g|ml)\b.*$/i, "")
    .replace(/\s+\d+\b.*$/i, "")
    .trim();
}

function buildSearchPhrases(query) {
  const raw = sanitizeText(query);

  if (!raw) {
    return [];
  }

  const stripped = raw
    .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|%)\b/gi, "")
    .replace(/\b(tablet|capsule|solution|suspension|injection|injectable|pen|kit)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return uniqueStrings([raw, stripped]);
}

function extractStrengthTokens(query) {
  return uniqueStrings(
    sanitizeText(query).match(/\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|%)(?:\/\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|%))?/gi) || [],
  ).map(normalizeStrength);
}

function createApprovalMap(approvalResults = []) {
  const approvals = new Map();

  approvalResults.forEach((application) => {
    const applicationNumber = sanitizeText(application.application_number);
    if (!applicationNumber) {
      return;
    }

    approvals.set(applicationNumber, application);
  });

  return approvals;
}

function createGroup(key) {
  return {
    key,
    id: "",
    score: 0,
    brandNames: new Set(),
    genericNames: new Set(),
    dosageForms: new Set(),
    routes: new Set(),
    strengths: new Set(),
    manufacturers: new Set(),
    marketingCategories: new Set(),
    productNdcs: new Set(),
    applicationNumbers: new Set(),
    sponsors: new Set(),
    activeListingCount: 0,
    inactiveListingCount: 0,
    packageCount: 0,
    ndcRecords: [],
    approvalRecord: null,
    preferredBrand: "",
    preferredGeneric: "",
    latestListingDate: null,
  };
}

function mergeNdcRecord(group, record, referenceDate) {
  const brandName = sanitizeText(record.brand_name || record.brand_name_base);
  const genericName = sanitizeText(record.generic_name);
  const manufacturerNames = uniqueStrings([
    record.labeler_name,
    ...(Array.isArray(record.openfda?.manufacturer_name) ? record.openfda.manufacturer_name : []),
  ]);
  const currentListing = isCurrentListing(record, referenceDate);
  const marketingStart = parseDate(record.marketing_start_date);

  if (brandName) {
    group.brandNames.add(titleCase(simplifyBrandName(brandName)));
  }

  if (genericName) {
    group.genericNames.add(titleCase(genericName));
  }

  manufacturerNames.forEach((name) => {
    group.manufacturers.add(titleCase(name));
  });

  if (record.dosage_form) {
    group.dosageForms.add(shortDosageForm(record.dosage_form));
  }

  (Array.isArray(record.route) ? record.route : []).forEach((route) => {
    group.routes.add(shortRoute(route));
  });

  const ingredients = Array.isArray(record.active_ingredients) ? record.active_ingredients : [];
  summarizeStrengthsFromIngredients(ingredients).forEach((strength) => {
    group.strengths.add(strength);
  });

  if (record.marketing_category) {
    group.marketingCategories.add(sanitizeText(record.marketing_category));
  }

  if (record.product_ndc) {
    group.productNdcs.add(sanitizeText(record.product_ndc));
  }

  if (record.application_number) {
    group.applicationNumbers.add(sanitizeText(record.application_number));
  }

  group.packageCount += Array.isArray(record.packaging) ? record.packaging.length : 0;
  group.ndcRecords.push(record);

  if (currentListing) {
    group.activeListingCount += 1;
  } else {
    group.inactiveListingCount += 1;
  }

  if (!group.latestListingDate || (marketingStart && marketingStart > group.latestListingDate)) {
    group.latestListingDate = marketingStart || group.latestListingDate;
  }
}

function extractBrandsFromApproval(application) {
  const productBrands = uniqueStrings(
    (Array.isArray(application.products) ? application.products : []).map((product) =>
      titleCase(simplifyBrandName(product.brand_name)),
    ),
  );

  if (productBrands.length) {
    return productBrands;
  }

  return uniqueStrings(
    Array.isArray(application.openfda?.brand_name)
      ? application.openfda.brand_name.map((value) => titleCase(simplifyBrandName(value)))
      : [],
  );
}

function mergeApprovalRecord(group, application) {
  if (!application) {
    return;
  }

  group.approvalRecord = application;

  const brands = extractBrandsFromApproval(application);
  brands.forEach((brand) => {
    group.brandNames.add(brand);
  });

  uniqueStrings(application.openfda?.generic_name || []).forEach((genericName) => {
    group.genericNames.add(titleCase(genericName));
  });

  uniqueStrings(application.openfda?.manufacturer_name || []).forEach((manufacturer) => {
    group.manufacturers.add(titleCase(manufacturer));
  });

  if (application.application_number) {
    group.applicationNumbers.add(sanitizeText(application.application_number));
  }

  if (application.sponsor_name) {
    group.sponsors.add(titleCase(application.sponsor_name));
  }

  (Array.isArray(application.products) ? application.products : []).forEach((product) => {
    if (product.dosage_form) {
      group.dosageForms.add(shortDosageForm(product.dosage_form));
    }

    if (product.route) {
      group.routes.add(shortRoute(product.route));
    }

    summarizeStrengthsFromIngredients(product.active_ingredients || []).forEach((strength) => {
      group.strengths.add(strength);
    });
  });
}

function scoreCandidate(queryContext, group) {
  const haystack = normalizeText(
    [
      ...group.brandNames,
      ...group.genericNames,
      ...group.dosageForms,
      ...group.routes,
    ].join(" "),
  );

  const displayName = normalizeText(group.preferredBrand || group.preferredGeneric);
  const baseQuery = queryContext.base;
  const tokens = queryContext.tokens;
  let score = 0;

  if (displayName === baseQuery) {
    score += 120;
  } else if (displayName.startsWith(baseQuery)) {
    score += 90;
  } else if (haystack.includes(baseQuery)) {
    score += 65;
  }

  const tokenMatches = tokens.filter((token) => haystack.includes(token)).length;
  score += tokenMatches * 12;

  if (queryContext.strengthTokens.some((token) => Array.from(group.strengths).some((strength) => normalizeText(strength).includes(normalizeText(token))))) {
    score += 18;
  }

  score += Math.min(group.activeListingCount * 2, 20);

  return score;
}

function finalizeGroup(queryContext, group) {
  const approvalBrands = group.approvalRecord ? extractBrandsFromApproval(group.approvalRecord) : [];
  const preferredBrand = approvalBrands[0] || Array.from(group.brandNames)[0] || "";
  const preferredGeneric = Array.from(group.genericNames)[0] || preferredBrand;
  const dosageForms = uniqueStrings(Array.from(group.dosageForms));
  const routes = uniqueStrings(Array.from(group.routes));
  const strengths = sortStrengths(Array.from(group.strengths));
  const manufacturers = uniqueStrings(Array.from(group.manufacturers));
  const applicationNumbers = uniqueStrings(Array.from(group.applicationNumbers));
  const productNdcs = uniqueStrings(Array.from(group.productNdcs));
  const sponsors = uniqueStrings(Array.from(group.sponsors));
  const canonicalLabel = uniqueStrings([preferredBrand || preferredGeneric, dosageForms[0], routes[0]]).join(" · ");

  group.preferredBrand = preferredBrand;
  group.preferredGeneric = preferredGeneric;
  group.score = scoreCandidate(queryContext, group);
  group.id =
    applicationNumbers[0]
      ? slugify(`${applicationNumbers[0]}-${preferredBrand || preferredGeneric}`)
      : slugify(canonicalLabel || preferredGeneric);

  return {
    id: group.id,
    score: group.score,
    displayName: preferredBrand || preferredGeneric,
    genericName: preferredGeneric,
    canonicalLabel,
    brandNames: uniqueStrings(Array.from(group.brandNames)),
    genericNames: uniqueStrings(Array.from(group.genericNames)),
    dosageForms,
    routes,
    strengths,
    manufacturers,
    marketingCategories: uniqueStrings(Array.from(group.marketingCategories)),
    applicationNumbers,
    productNdcs,
    sponsors,
    activeListingCount: group.activeListingCount,
    inactiveListingCount: group.inactiveListingCount,
    packageCount: group.packageCount,
    latestListingDate: formatIsoDate(group.latestListingDate),
    approvalRecord: group.approvalRecord,
  };
}

function buildCandidateContexts(query, ndcPayload, approvalsPayload) {
  const referenceDate = new Date();
  const queryContext = {
    raw: sanitizeText(query),
    base: normalizeText(buildSearchPhrases(query)[1] || query),
    tokens: normalizeText(query)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 2),
    strengthTokens: extractStrengthTokens(query),
  };
  const approvalMap = createApprovalMap(approvalsPayload?.results || []);
  const groups = new Map();

  (Array.isArray(ndcPayload?.results) ? ndcPayload.results : []).forEach((record) => {
    const key =
      sanitizeText(record.application_number)
        ? `app:${sanitizeText(record.application_number)}`
        : `family:${slugify(
            [
              record.brand_name || record.brand_name_base || record.generic_name,
              record.dosage_form,
              Array.isArray(record.route) ? record.route.join(" ") : "",
            ]
              .map(sanitizeText)
              .join(" "),
          )}`;

    const group = groups.get(key) || createGroup(key);
    mergeNdcRecord(group, record, referenceDate);

    const applicationNumber = sanitizeText(record.application_number);
    if (applicationNumber && approvalMap.has(applicationNumber)) {
      mergeApprovalRecord(group, approvalMap.get(applicationNumber));
    }

    groups.set(key, group);
  });

  approvalMap.forEach((application, applicationNumber) => {
    const key = `app:${applicationNumber}`;
    const group = groups.get(key) || createGroup(key);
    mergeApprovalRecord(group, application);
    groups.set(key, group);
  });

  return Array.from(groups.values())
    .map((group) => finalizeGroup(queryContext, group))
    .filter((group) => group.displayName || group.genericName)
    .sort((left, right) => right.score - left.score || right.activeListingCount - left.activeListingCount)
    .slice(0, MAX_MATCHES);
}

function normalizeShortageStatus(status) {
  const normalized = normalizeText(status);

  if (normalized.includes("resolved")) {
    return "resolved";
  }

  if (normalized.includes("discontinued")) {
    return "discontinued";
  }

  if (normalized.includes("available")) {
    return "available";
  }

  return "active";
}

function normalizeShortageItems(payload) {
  return (Array.isArray(payload?.results) ? payload.results : []).map((entry) => ({
    status: sanitizeText(entry.status) || "Status unavailable",
    normalizedStatus: normalizeShortageStatus(entry.status),
    presentation: sanitizeText(entry.presentation),
    companyName: sanitizeText(entry.company_name),
    dosageForm: sanitizeText(entry.dosage_form),
    updateDate: formatIsoDate(entry.update_date),
    updateLabel: formatDisplayDate(entry.update_date),
    shortageReason: sanitizeText(entry.shortage_reason),
    availability: sanitizeText(entry.availability),
    therapeuticCategory: uniqueStrings(entry.therapeutic_category || []),
    relatedInfo: sanitizeText(entry.related_info),
    contactInfo: sanitizeText(entry.contact_info),
    discontinuedDate: formatIsoDate(entry.discontinued_date),
  }));
}

function normalizeRecallItems(payload, referenceDate) {
  return (Array.isArray(payload?.results) ? payload.results : []).map((item) => ({
    recallNumber: sanitizeText(item.recall_number),
    status: sanitizeText(item.status),
    classification: sanitizeText(item.classification),
    reason: sanitizeText(item.reason_for_recall),
    reportDate: formatIsoDate(item.report_date),
    reportDateLabel: formatDisplayDate(item.report_date),
    productDescription: sanitizeText(item.product_description),
    distributionPattern: sanitizeText(item.distribution_pattern),
    recallingFirm: sanitizeText(item.recalling_firm),
    recent: getRelativeDaysAgo(item.report_date, referenceDate) <= RECENT_RECALL_WINDOW_DAYS,
  }));
}

function buildSignalAssessment(candidate, shortages, recalls) {
  const activeShortages = shortages.filter((item) => item.normalizedStatus === "active");
  const availableShortages = shortages.filter((item) => item.normalizedStatus === "available");
  const discontinuedShortages = shortages.filter((item) => item.normalizedStatus === "discontinued");
  const recentRecalls = recalls.filter((item) => item.recent);
  const ongoingRecalls = recentRecalls.filter((item) => normalizeText(item.status) === "ongoing");
  const manufacturerCount = candidate.manufacturers.length;

  let score = 0;
  const drivers = [];

  if (activeShortages.length) {
    score += 58;
    drivers.push(`${activeShortages.length} FDA shortage entr${activeShortages.length === 1 ? "y is" : "ies are"} active for a matching presentation.`);
  } else if (availableShortages.length) {
    score += 22;
    drivers.push("A matching product appears in the FDA shortage dataset, but the listed status is currently available.");
  }

  if (discontinuedShortages.length) {
    score += 24;
    drivers.push(`${discontinuedShortages.length} matching presentation${discontinuedShortages.length === 1 ? " is" : "s are"} flagged for discontinuation.`);
  }

  if (manufacturerCount <= 1) {
    score += 16;
    drivers.push("Only one manufacturer surfaced in the matching FDA listings.");
  } else if (manufacturerCount === 2) {
    score += 8;
    drivers.push("Only two manufacturers surfaced in the matching FDA listings.");
  }

  if (candidate.activeListingCount <= 2) {
    score += 10;
    drivers.push("Only a small number of active FDA listings matched this search.");
  } else if (candidate.activeListingCount >= 6) {
    score -= 8;
  }

  if (recentRecalls.length) {
    score += 12;
    drivers.push(`${recentRecalls.length} recent recall notice${recentRecalls.length === 1 ? "" : "s"} matched this product family.`);
  }

  if (recentRecalls.length >= 2) {
    score += 10;
  }

  if (ongoingRecalls.length) {
    score += 6;
  }

  let level = STEADIER;
  if (score >= 55) {
    level = HIGHER_FRICTION;
  } else if (score >= 28) {
    level = MIXED;
  }

  const label =
    level === HIGHER_FRICTION
      ? "Higher-friction access signal"
      : level === MIXED
        ? "Mixed access signal"
        : "Steadier access signal";

  const patientSummary =
    level === HIGHER_FRICTION
      ? "FDA signals suggest this exact medication family may be harder than average to obtain."
      : level === MIXED
        ? "FDA signals are mixed: this may be obtainable, but there are still supply friction clues worth checking."
        : "openFDA does not show a strong supply warning for the matching FDA listings, but that is still not live store inventory.";

  const prescriberSummary =
    level === HIGHER_FRICTION
      ? "Shortage, discontinuation, or concentration signals justify a backup plan before the patient starts calling pharmacies."
      : level === MIXED
        ? "There is no single decisive shortage signal, but formulation breadth or manufacturer concentration may still affect fill success."
        : "The FDA data looks relatively stable compared with typical shortage patterns, though retail access can still vary locally.";

  return {
    level,
    label,
    score,
    drivers: drivers.length
      ? drivers
      : ["No strong shortage or recall signal surfaced in the matching FDA records."],
    patientSummary,
    prescriberSummary,
  };
}

function buildPatientQuestions(candidate, signal) {
  const questions = [
    `Do you currently have ${candidate.displayName} in the exact strength and formulation listed on my prescription?`,
    "If not, which strength or formulation is usually easier to fill right now?",
  ];

  if (signal.level === HIGHER_FRICTION || signal.level === MIXED) {
    questions.push("Should I ask my prescriber about alternatives before I keep calling pharmacies?");
  } else {
    questions.push("If you cannot fill it today, what is the usual turnaround for this medication?");
  }

  return questions;
}

function buildPrescriberTakeaways(candidate, shortages, recalls, signal) {
  const takeaways = [];

  if (shortages.some((item) => item.normalizedStatus === "active")) {
    takeaways.push("Active shortage file present for at least one matching presentation.");
  } else {
    takeaways.push("No active shortage file surfaced for the top matching presentations.");
  }

  if (candidate.manufacturers.length <= 1) {
    takeaways.push("Manufacturer diversity appears limited in the matching FDA listings.");
  } else {
    takeaways.push(`${candidate.manufacturers.length} manufacturers surfaced across the matched FDA listings.`);
  }

  if (candidate.strengths.length <= 2) {
    takeaways.push("The listed strength/formulation spread is narrow, which may limit substitution flexibility.");
  } else {
    takeaways.push(`${candidate.strengths.length} distinct strengths surfaced in the matched FDA listings.`);
  }

  if (recalls.some((item) => item.recent)) {
    takeaways.push("Recent recall activity may add additional supply or confidence friction.");
  }

  if (signal.level === HIGHER_FRICTION) {
    takeaways.push("Consider alternatives or backup routing sooner if the patient needs a same-day fill.");
  }

  return takeaways;
}

function buildCandidateOutput(candidate, shortagePayload, recallPayload, referenceDate) {
  const shortages = normalizeShortageItems(shortagePayload);
  const recalls = normalizeRecallItems(recallPayload, referenceDate);
  const signal = buildSignalAssessment(candidate, shortages, recalls);
  const activeShortages = shortages.filter((item) => item.normalizedStatus === "active");
  const recentRecalls = recalls.filter((item) => item.recent);

  const knownFacts = [
    activeShortages.length
      ? `${activeShortages.length} active FDA shortage entr${activeShortages.length === 1 ? "y" : "ies"} matched this product family.`
      : "No active FDA shortage entry surfaced for the top matching presentations.",
    `${candidate.activeListingCount} active FDA listing${candidate.activeListingCount === 1 ? "" : "s"} across ${candidate.manufacturers.length} manufacturer${candidate.manufacturers.length === 1 ? "" : "s"}.`,
    recentRecalls.length
      ? `${recentRecalls.length} recent recall notice${recentRecalls.length === 1 ? "" : "s"} matched this product family.`
      : "No recent recall notice surfaced for this product family in the FDA enforcement data.",
  ];

  const frictionSignals = [
    ...signal.drivers,
    candidate.strengths.length <= 2
      ? "Only a limited number of listed strengths surfaced for this search."
      : `${candidate.strengths.length} listed strengths surfaced, which can give prescribers more routing flexibility.`,
  ];

  return {
    id: candidate.id,
    display_name: candidate.displayName,
    generic_name: candidate.genericName,
    canonical_label: candidate.canonicalLabel,
    brand_names: candidate.brandNames,
    dosage_forms: candidate.dosageForms,
    routes: candidate.routes,
    strengths: candidate.strengths,
    manufacturers: candidate.manufacturers,
    sponsors: candidate.sponsors,
    application_numbers: candidate.applicationNumbers,
    product_ndcs: candidate.productNdcs,
    marketing_categories: candidate.marketingCategories,
    active_listing_count: candidate.activeListingCount,
    inactive_listing_count: candidate.inactiveListingCount,
    package_count: candidate.packageCount,
    latest_listing_date: candidate.latestListingDate,
    access_signal: {
      level: signal.level,
      label: signal.label,
      confidence_label: "Signal-based estimate",
      reasoning: signal.drivers,
      patient_summary: signal.patientSummary,
      prescriber_summary: signal.prescriberSummary,
    },
    patient_view: {
      headline: signal.label,
      summary: signal.patientSummary,
      what_we_know: knownFacts,
      what_may_make_it_harder: frictionSignals,
      questions_to_ask: buildPatientQuestions(candidate, signal),
      unavailable: UNAVAILABLE_DATA,
    },
    prescriber_view: {
      headline: signal.label,
      summary: signal.prescriberSummary,
      takeaways: buildPrescriberTakeaways(candidate, shortages, recalls, signal),
      should_consider_alternatives: signal.level !== STEADIER,
    },
    evidence: {
      shortages: {
        total: shortages.length,
        active_count: activeShortages.length,
        items: shortages,
      },
      recalls: {
        total: recalls.length,
        recent_count: recentRecalls.length,
        items: recalls,
      },
      approvals: buildApprovalSummary(candidate.approvalRecord),
    },
  };
}

function buildApprovalSummary(application) {
  if (!application) {
    return {
      sponsor_name: null,
      latest_submission_date: null,
      recent_manufacturing_updates: [],
      recent_labeling_updates: [],
    };
  }

  const submissions = Array.isArray(application.submissions) ? application.submissions : [];
  const latestSubmission = submissions.reduce((latest, submission) => {
    const currentDate = parseDate(submission.submission_status_date);
    if (!currentDate) {
      return latest;
    }

    if (!latest || currentDate > latest) {
      return currentDate;
    }

    return latest;
  }, null);

  const manufacturingUpdates = submissions
    .filter((submission) => normalizeText(submission.submission_class_code_description).includes("manufact"))
    .slice(0, 4)
    .map((submission) => ({
      type: sanitizeText(submission.submission_class_code_description),
      date: formatIsoDate(submission.submission_status_date),
      date_label: formatDisplayDate(submission.submission_status_date),
      status: sanitizeText(submission.submission_status),
    }));

  const labelingUpdates = submissions
    .filter((submission) => normalizeText(submission.submission_class_code_description).includes("label"))
    .slice(0, 4)
    .map((submission) => ({
      type: sanitizeText(submission.submission_class_code_description),
      date: formatIsoDate(submission.submission_status_date),
      date_label: formatDisplayDate(submission.submission_status_date),
      status: sanitizeText(submission.submission_status),
    }));

  return {
    sponsor_name: sanitizeText(application.sponsor_name) || null,
    latest_submission_date: formatIsoDate(latestSubmission),
    latest_submission_label: formatDisplayDate(latestSubmission),
    recent_manufacturing_updates: manufacturingUpdates,
    recent_labeling_updates: labelingUpdates,
  };
}

function buildDrugIntelligencePayload({
  query,
  ndcPayload,
  approvalsPayload,
  shortageResultsById,
  recallResultsById,
}) {
  const referenceDate = new Date();
  const candidates = buildCandidateContexts(query, ndcPayload, approvalsPayload);
  const matches = candidates.map((candidate) =>
    buildCandidateOutput(
      candidate,
      shortageResultsById[candidate.id],
      recallResultsById[candidate.id],
      referenceDate,
    ),
  );
  // Pick the match with the most data: prefer active shortages, then most
  // active listings, then fall back to first result.
  const featured =
    matches.find((m) => m.evidence?.shortages?.active_count > 0) ||
    matches.reduce(
      (best, m) => ((m.active_listing_count ?? 0) > (best.active_listing_count ?? 0) ? m : best),
      matches[0],
    ) ||
    null;

  return {
    status: "ok",
    generated_at: new Date().toISOString(),
    query: {
      raw: sanitizeText(query),
      search_phrases: buildSearchPhrases(query),
    },
    data_freshness: {
      ndc_last_updated: formatIsoDate(ndcPayload?.meta?.last_updated),
      shortages_last_updated: formatIsoDate(
        Object.values(shortageResultsById).find((payload) => payload?.meta?.last_updated)?.meta?.last_updated,
      ),
      approvals_last_updated: formatIsoDate(approvalsPayload?.meta?.last_updated),
      recalls_last_updated: formatIsoDate(
        Object.values(recallResultsById).find((payload) => payload?.meta?.last_updated)?.meta?.last_updated,
      ),
    },
    featured_match_id: featured?.id || null,
    matches,
    limitations: [
      "openFDA does not provide live retail shelf inventory.",
      "The access signal is inferred from FDA listings, shortage records, discontinuation signals, and recall activity.",
      ...UNAVAILABLE_DATA.map((item) => `${item} is not available in openFDA.`),
    ],
    methodology_summary:
      "PharmaPath reads FDA listing, shortage, approval, and recall datasets, then translates them into a signal-based access summary without claiming real-time pharmacy stock.",
  };
}

module.exports = {
  buildCandidateContexts,
  buildDrugIntelligencePayload,
  buildSearchPhrases,
  formatDisplayDate,
};
