"use strict";

const OPENFDA_NDC_BULK_URL =
  "https://download.open.fda.gov/drug/ndc/drug-ndc-0001-of-0001.json.zip";
const HUMAN_PRODUCT_TYPES = new Set(["HUMAN PRESCRIPTION DRUG", "HUMAN OTC DRUG"]);
const PRESERVE_UPPERCASE_TOKENS = new Set(["XR", "ER", "IR", "XL", "SR", "ODT", "HCL", "OTC"]);
const FEATURED_MEDICATION_QUERIES = [
  "Adderall XR 20 mg",
  "Wegovy 0.25 mg/0.5 ml",
  "Amoxicillin 500 mg capsule",
  "Sertraline 50 mg tablet",
  "Concerta 18 mg",
  "Vyvanse 30 mg capsule",
  "Ibuprofen 200 mg liquid-filled capsule",
];

const WORKFLOW_MATCHERS = [
  {
    key: "controlled_stimulant",
    patterns: [
      /\badderall\b/i,
      /\bamphetamine\b/i,
      /\bdextroamphetamine\b/i,
      /\bvyvanse\b/i,
      /\blisdexamfetamine\b/i,
      /\bconcerta\b/i,
      /\britalin\b/i,
      /\bmethylphenidate\b/i,
      /\bfocalin\b/i,
      /\bdexmethylphenidate\b/i,
    ],
  },
  {
    key: "acute_antibiotic",
    patterns: [
      /\bamoxicillin\b/i,
      /\bamox-clav\b/i,
      /\bamoxicillin-clavulanate\b/i,
      /\baugmentin\b/i,
      /\bazithromycin\b/i,
      /\bcephalexin\b/i,
      /\bdoxycycline\b/i,
      /\bclindamycin\b/i,
      /\bciprofloxacin\b/i,
      /\bcefdinir\b/i,
      /\bpenicillin\b/i,
    ],
  },
  {
    key: "cold_chain",
    patterns: [
      /\bozempic\b/i,
      /\bwegovy\b/i,
      /\bmounjaro\b/i,
      /\bzepbound\b/i,
      /\btrulicity\b/i,
      /\bsaxenda\b/i,
      /\bvictoza\b/i,
      /\bsemaglutide\b/i,
      /\btirzepatide\b/i,
      /\bdulaglutide\b/i,
      /\bliraglutide\b/i,
      /\binsulin\b/i,
    ],
  },
];

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMedicationText(value) {
  return sanitizeText(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeIdentifier(value) {
  return sanitizeText(value).replace(/[^0-9a-z]/gi, "").toLowerCase();
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
    .map((token) =>
      token
        .split("-")
        .map((segment) => {
          const upperToken = segment.toUpperCase();

          if (PRESERVE_UPPERCASE_TOKENS.has(upperToken)) {
            return upperToken;
          }

          if (/^[A-Z0-9]{1,4}$/.test(segment)) {
            return segment.toUpperCase();
          }

          return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
        })
        .join("-"),
    )
    .join(" ");
}

function cleanMedicationName(value) {
  const cleaned = titleCase(value)
    .replace(/^[.\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function normalizeStrength(value) {
  return sanitizeText(value)
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/(\d)(mg|mcg|g|ml|iu|units?|%)/gi, (match, amount, unit) => {
      const normalizedUnit = /^units?$/i.test(unit) ? "units" : unit.toLowerCase();
      return `${amount} ${normalizedUnit}`;
    })
    .replace(/(^|[/\s])\.(\d)/g, (match, prefix, decimal) => `${prefix}0.${decimal}`)
    .replace(/\/1$/g, "");
}

function numericStrengthValue(value) {
  const match = sanitizeText(value).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function formatNumericStrength(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function summarizeStrengths(activeIngredients) {
  const strengths = activeIngredients
    .map((ingredient) => ingredient.strength)
    .filter(Boolean);

  if (strengths.length <= 1) {
    return strengths[0] || null;
  }

  const parsed = strengths.map((strength) => {
    const match = strength.match(/^(\d+(?:\.\d+)?)\s*([a-z%]+)$/i);
    if (!match) {
      return null;
    }

    return {
      amount: Number(match[1]),
      unit: match[2].toLowerCase(),
    };
  });

  if (parsed.some((entry) => !entry)) {
    return uniqueStrings(strengths).join(" / ");
  }

  if (new Set(parsed.map((entry) => entry.unit)).size !== 1) {
    return uniqueStrings(strengths).join(" / ");
  }

  const total = parsed.reduce((sum, entry) => sum + entry.amount, 0);
  return `${formatNumericStrength(total)} ${parsed[0].unit}`;
}

function formatDosageForm(value) {
  const normalized = sanitizeText(value).toLowerCase().replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  const replacements = new Map([
    ["capsule, delayed release", "delayed-release capsule"],
    ["capsule, extended release", "extended-release capsule"],
    ["capsule, liquid filled", "liquid-filled capsule"],
    ["tablet, delayed release", "delayed-release tablet"],
    ["tablet, extended release", "extended-release tablet"],
    ["tablet, film coated", "film-coated tablet"],
    ["tablet, coated", "coated tablet"],
    ["tablet, orally disintegrating", "orally-disintegrating tablet"],
  ]);

  if (replacements.has(normalized)) {
    return replacements.get(normalized);
  }

  return normalized
    .replace(/\bfilm coated\b/i, "film-coated")
    .replace(/\bdelayed release\b/i, "delayed-release")
    .replace(/\bextended release\b/i, "extended-release")
    .replace(/\bliquid filled\b/i, "liquid-filled")
    .replace(/\borally disintegrating\b/i, "orally-disintegrating")
    .replace(/\s+/g, " ")
    .trim();
}

function formatRoute(value) {
  const normalized = sanitizeText(value).toLowerCase().replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  if (normalized === "oral") {
    return "Oral";
  }

  if (normalized === "topical") {
    return "Topical";
  }

  if (normalized === "subcutaneous") {
    return "Subcutaneous";
  }

  if (normalized === "intravenous") {
    return "Intravenous";
  }

  if (normalized === "intramuscular") {
    return "Intramuscular";
  }

  return titleCase(normalized);
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

  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function slugify(value) {
  return normalizeMedicationText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createStableId(value) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(36);
}

function pickBestName(values) {
  return uniqueStrings(values).sort((left, right) => {
    return left.length - right.length || left.localeCompare(right);
  })[0] || null;
}

function buildReleaseAliases(primaryName, strength, dosageForm) {
  const normalizedForm = normalizeMedicationText(dosageForm);
  const aliases = [];

  if (!primaryName || !normalizedForm) {
    return aliases;
  }

  if (normalizedForm.includes("extended-release")) {
    aliases.push(`${primaryName} XR`, `${primaryName} XR ${strength || ""}`.trim());
    aliases.push(
      `${primaryName} extended release`,
      `${primaryName} extended release ${strength || ""}`.trim(),
    );
  }

  if (normalizedForm.includes("delayed-release")) {
    aliases.push(`${primaryName} DR`, `${primaryName} DR ${strength || ""}`.trim());
    aliases.push(
      `${primaryName} delayed release`,
      `${primaryName} delayed release ${strength || ""}`.trim(),
    );
  }

  if (normalizedForm.includes("orally-disintegrating")) {
    aliases.push(`${primaryName} ODT`, `${primaryName} ODT ${strength || ""}`.trim());
  }

  return uniqueStrings(aliases);
}

function deriveWorkflowCategory(values) {
  const haystack = uniqueStrings(values).join(" ");
  const matched =
    WORKFLOW_MATCHERS.find(({ patterns }) => patterns.some((pattern) => pattern.test(haystack)))
      ?.key || "maintenance_refill";

  return matched;
}

function buildIngredientSignature(activeIngredients) {
  return uniqueStrings(
    activeIngredients.map((ingredient) =>
      [normalizeMedicationText(ingredient.name), normalizeMedicationText(ingredient.strength)].join("|"),
    ),
  )
    .sort()
    .join(";");
}

function isMarketedHumanDrugRecord(record, referenceDate) {
  if (!record || !HUMAN_PRODUCT_TYPES.has(sanitizeText(record.product_type))) {
    return false;
  }

  if (record.finished !== true) {
    return false;
  }

  const marketingStartDate = parseDate(record.marketing_start_date);
  if (marketingStartDate && marketingStartDate > referenceDate) {
    return false;
  }

  const marketingEndDate = parseDate(record.marketing_end_date);
  if (marketingEndDate && marketingEndDate < referenceDate) {
    return false;
  }

  const listingExpirationDate = parseDate(record.listing_expiration_date);
  if (listingExpirationDate && listingExpirationDate < referenceDate) {
    return false;
  }

  return true;
}

function normalizeOpenFdaProduct(record, referenceDate) {
  if (!isMarketedHumanDrugRecord(record, referenceDate)) {
    return null;
  }

  const brandName = cleanMedicationName(record.brand_name_base || record.brand_name);
  const genericName = cleanMedicationName(record.generic_name);
  const activeIngredients = (record.active_ingredients || [])
    .map((ingredient) => ({
      name: cleanMedicationName(ingredient?.name),
      strength: normalizeStrength(ingredient?.strength) || null,
    }))
    .filter((ingredient) => ingredient.name);
  const route = pickBestName((record.route || []).map(formatRoute));
  const dosageForm = formatDosageForm(record.dosage_form);
  const strength = summarizeStrengths(activeIngredients);
  const preferredName =
    brandName && normalizeMedicationText(brandName) !== normalizeMedicationText(genericName)
      ? brandName
      : genericName || brandName;

  if (!preferredName) {
    return null;
  }

  const routeKey = normalizeMedicationText(route);
  const dosageFormKey = normalizeMedicationText(dosageForm);
  const preferredNameKey = normalizeMedicationText(preferredName);
  const ingredientSignature = buildIngredientSignature(activeIngredients);
  const groupingKey = [
    preferredNameKey,
    normalizeMedicationText(strength),
    dosageFormKey,
    routeKey,
    ingredientSignature,
  ].join("|");

  return {
    groupingKey,
    preferredName,
    brandName: brandName || null,
    genericName: genericName || null,
    strength: strength || null,
    dosageForm: dosageForm || null,
    route: route || null,
    activeIngredients,
    productType: sanitizeText(record.product_type),
    marketingCategory: sanitizeText(record.marketing_category),
    labelerName: titleCase(record.labeler_name),
    productNdc: sanitizeText(record.product_ndc),
    productId: sanitizeText(record.product_id),
    packageNdcs: uniqueStrings((record.packaging || []).map((entry) => entry?.package_ndc)),
  };
}

function createMedicationAggregator({
  referenceDate = new Date(),
  featuredQueries = FEATURED_MEDICATION_QUERIES,
} = {}) {
  const groups = new Map();
  let processed = 0;
  let included = 0;

  function ingest(record) {
    processed += 1;

    const normalized = normalizeOpenFdaProduct(record, referenceDate);
    if (!normalized) {
      return;
    }

    included += 1;

    const existing =
      groups.get(normalized.groupingKey) ||
      {
        key: normalized.groupingKey,
        preferredNames: new Set(),
        brandNames: new Set(),
        genericNames: new Set(),
        strengths: new Set(),
        dosageForms: new Set(),
        routes: new Set(),
        productNdcs: new Set(),
        productIds: new Set(),
        labelers: new Set(),
        productTypes: new Set(),
        marketingCategories: new Set(),
        activeIngredientsByKey: new Map(),
        packageCount: 0,
      };

    existing.preferredNames.add(normalized.preferredName);

    if (normalized.brandName) {
      existing.brandNames.add(normalized.brandName);
    }

    if (normalized.genericName) {
      existing.genericNames.add(normalized.genericName);
    }

    if (normalized.strength) {
      existing.strengths.add(normalized.strength);
    }

    if (normalized.dosageForm) {
      existing.dosageForms.add(normalized.dosageForm);
    }

    if (normalized.route) {
      existing.routes.add(normalized.route);
    }

    if (normalized.productNdc) {
      existing.productNdcs.add(normalized.productNdc);
    }

    if (normalized.productId) {
      existing.productIds.add(normalized.productId);
    }

    if (normalized.labelerName) {
      existing.labelers.add(normalized.labelerName);
    }

    if (normalized.productType) {
      existing.productTypes.add(normalized.productType);
    }

    if (normalized.marketingCategory) {
      existing.marketingCategories.add(normalized.marketingCategory);
    }

    existing.packageCount += normalized.packageNdcs.length;

    normalized.activeIngredients.forEach((ingredient) => {
      const ingredientKey = [
        normalizeMedicationText(ingredient.name),
        normalizeMedicationText(ingredient.strength),
      ].join("|");

      if (!existing.activeIngredientsByKey.has(ingredientKey)) {
        existing.activeIngredientsByKey.set(ingredientKey, ingredient);
      }
    });

    groups.set(normalized.groupingKey, existing);
  }

  function finalize({ sourceLastUpdated = null } = {}) {
    const finalized = Array.from(groups.values()).map((group) => {
      const brandName = pickBestName(Array.from(group.brandNames));
      const genericName = pickBestName(Array.from(group.genericNames));
      const strength = pickBestName(
        Array.from(group.strengths).sort((left, right) => {
          return numericStrengthValue(left) - numericStrengthValue(right) || left.localeCompare(right);
        }),
      );
      const dosageForm = pickBestName(Array.from(group.dosageForms));
      const route = pickBestName(Array.from(group.routes));
      const activeIngredients = Array.from(group.activeIngredientsByKey.values()).sort((left, right) => {
        return left.name.localeCompare(right.name) || (left.strength || "").localeCompare(right.strength || "");
      });
      const primaryName =
        brandName && normalizeMedicationText(brandName) !== normalizeMedicationText(genericName)
          ? brandName
          : genericName || pickBestName(Array.from(group.preferredNames));
      const baseDisplayLabel = [primaryName, strength].filter(Boolean).join(" ");
      const medicationDescriptor = [route, dosageForm].filter(Boolean).join(" ").trim();
      const badge =
        group.productTypes.size === 1
          ? group.productTypes.has("HUMAN OTC DRUG")
            ? "OTC"
            : "Rx"
          : group.productTypes.size > 1
            ? "Rx/OTC"
            : null;
      const genericLine =
        genericName && normalizeMedicationText(genericName) !== normalizeMedicationText(primaryName)
          ? genericName
          : null;
      const shortGenericLine =
        genericLine && genericLine.length <= 52 ? genericLine : null;
      const description = [shortGenericLine, medicationDescriptor || null]
        .filter(Boolean)
        .join(" • ") || badge || "Marketed human drug";
      const aliases = uniqueStrings(
        [
          baseDisplayLabel,
          primaryName,
          genericName,
          brandName,
          strength ? [primaryName, strength].filter(Boolean).join(" ") : null,
          strength ? [genericName, strength].filter(Boolean).join(" ") : null,
          strength ? [brandName, strength].filter(Boolean).join(" ") : null,
          ...activeIngredients.map((ingredient) => ingredient.name),
          ...buildReleaseAliases(primaryName, strength, dosageForm),
          ...Array.from(group.productNdcs),
          ...Array.from(group.productNdcs).map(normalizeIdentifier),
        ],
      );

      return {
        id: `${slugify(baseDisplayLabel || primaryName)}-${createStableId(group.key)}`,
        baseDisplayLabel,
        displayLabel: baseDisplayLabel,
        description,
        badge,
        brandName: brandName || null,
        genericName: genericName || null,
        strength: strength || null,
        dosageForm: dosageForm || null,
        route: route || null,
        activeIngredients,
        aliases,
        ndcProductCodes: Array.from(group.productNdcs).sort(),
        productCount: group.productNdcs.size,
        packageCount: group.packageCount,
        labelerCount: group.labelers.size,
        marketingCategories: Array.from(group.marketingCategories).sort(),
        productTypes: Array.from(group.productTypes).sort(),
        workflowCategory: deriveWorkflowCategory([
          primaryName,
          genericName,
          brandName,
          ...activeIngredients.map((ingredient) => ingredient.name),
        ]),
      };
    });

    const labelsByBase = finalized.reduce((map, record) => {
      const key = normalizeMedicationText(record.baseDisplayLabel);
      map.set(key, [...(map.get(key) || []), record.id]);
      return map;
    }, new Map());

    finalized.forEach((record) => {
      const collisions = labelsByBase.get(normalizeMedicationText(record.baseDisplayLabel)) || [];
      if (collisions.length === 1) {
        record.displayLabel = record.baseDisplayLabel;
        record.aliases = uniqueStrings([record.displayLabel, ...record.aliases]);
        return;
      }

      const withDosageForm = [record.baseDisplayLabel, record.dosageForm].filter(Boolean).join(" ");
      record.displayLabel = withDosageForm;
      record.aliases = uniqueStrings([record.displayLabel, record.baseDisplayLabel, ...record.aliases]);
    });

    const finalLabelCollisions = finalized.reduce((map, record) => {
      const key = normalizeMedicationText(record.displayLabel);
      map.set(key, [...(map.get(key) || []), record.id]);
      return map;
    }, new Map());

    finalized.forEach((record) => {
      const collisions = finalLabelCollisions.get(normalizeMedicationText(record.displayLabel)) || [];
      if (collisions.length === 1) {
        return;
      }

      record.displayLabel = [record.displayLabel, record.route].filter(Boolean).join(" ");
      record.aliases = uniqueStrings([record.displayLabel, ...record.aliases]);
    });

    finalized.sort((left, right) => {
      return (
        left.displayLabel.localeCompare(right.displayLabel) ||
        right.productCount - left.productCount ||
        left.id.localeCompare(right.id)
      );
    });

    const featuredMedicationIds = [];

    featuredQueries.forEach((query) => {
      const normalizedQuery = normalizeMedicationText(query);
      const match = finalized.find((record) =>
        record.aliases.some((alias) => normalizeMedicationText(alias) === normalizedQuery),
      );

      if (match && !featuredMedicationIds.includes(match.id)) {
        featuredMedicationIds.push(match.id);
      }
    });

    return {
      generatedAt: new Date().toISOString(),
      source: {
        name: "openFDA NDC",
        bulkUrl: OPENFDA_NDC_BULK_URL,
        datasetLastUpdated: sanitizeText(sourceLastUpdated) || null,
      },
      counts: {
        processed,
        included,
        canonical: finalized.length,
      },
      featuredMedicationIds,
      records: finalized,
    };
  }

  return {
    ingest,
    finalize,
  };
}

function buildMedicationSnapshotFromOpenFdaRecords(records, options = {}) {
  const aggregator = createMedicationAggregator(options);
  for (const record of records) {
    aggregator.ingest(record);
  }

  return aggregator.finalize({
    sourceLastUpdated: options.sourceLastUpdated || null,
  });
}

module.exports = {
  FEATURED_MEDICATION_QUERIES,
  OPENFDA_NDC_BULK_URL,
  buildMedicationSnapshotFromOpenFdaRecords,
  createMedicationAggregator,
  deriveWorkflowCategory,
  isMarketedHumanDrugRecord,
  normalizeIdentifier,
  normalizeMedicationText,
  normalizeOpenFdaProduct,
};
