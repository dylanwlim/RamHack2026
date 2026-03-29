"use strict";

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value) {
  return sanitizeText(value).toLowerCase().replace(/\s+/g, " ");
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeStrengthValue(value) {
  return sanitizeText(value)
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/(\d)(mg|mcg|g|ml|iu|units?|%)/gi, (match, amount, unit) => {
      const normalizedUnit = /^units?$/i.test(unit) ? "units" : unit.toLowerCase();
      return `${amount} ${normalizedUnit}`;
    })
    .replace(/(^|[\/\s])\.(\d)/g, (match, prefix, decimal) => `${prefix}0.${decimal}`)
    .replace(/\/1$/g, "");
}

function numericStrengthValue(value) {
  const match = normalizeStrengthValue(value).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function sortStrengthValues(values) {
  return Array.from(
    new Set(
      values.map(normalizeStrengthValue).filter(Boolean),
    ),
  ).sort((left, right) => {
    return numericStrengthValue(left) - numericStrengthValue(right) || left.localeCompare(right);
  });
}

function toStrengthOption(value) {
  const normalizedValue = normalizeStrengthValue(value);
  const match = normalizedValue.match(/^(\d+(?:\.\d+)?)\s*([a-z%/]+)$/i);

  return {
    id: `strength-${slugify(normalizedValue)}`,
    label: normalizedValue,
    value: normalizedValue,
    amount: match ? Number(match[1]) : null,
    unit: match ? match[2].toLowerCase() : null,
  };
}

function inferMatchedStrength(query, strengths) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return null;
  }

  const normalizedStrengths = sortStrengthValues(
    (strengths || []).map((strength) => (typeof strength === "string" ? strength : strength?.value)),
  ).sort((left, right) => right.length - left.length);

  return normalizedStrengths.find((strength) => normalizedQuery.includes(normalizeText(strength))) || null;
}

function buildMedicationQueryLabel(option, selectedStrength) {
  if (!option) {
    return sanitizeText(selectedStrength);
  }

  const baseLabel = sanitizeText(option.queryBaseLabel || option.canonicalName || option.label || option.value);
  const strengthLabel = normalizeStrengthValue(selectedStrength || option.matchedStrength || "");
  const dosageForm = sanitizeText(option.queryDosageForm);
  const segments = [baseLabel, strengthLabel, dosageForm].filter(Boolean);

  return segments.join(" ").replace(/\s+/g, " ").trim();
}

module.exports = {
  buildMedicationQueryLabel,
  inferMatchedStrength,
  normalizeStrengthValue,
  sortStrengthValues,
  toStrengthOption,
};
