"use strict";

const SHORTAGE_TOKEN_STOP_WORDS = new Set([
  "and",
  "or",
  "with",
  "for",
  "the",
  "acetate",
  "aspartate",
  "besylate",
  "bromide",
  "calcium",
  "capsule",
  "chloride",
  "citrate",
  "fumarate",
  "hydrochloride",
  "hydrobromide",
  "injection",
  "maleate",
  "mesylate",
  "monohydrate",
  "phosphate",
  "potassium",
  "saccharate",
  "salts",
  "sodium",
  "solution",
  "succinate",
  "sulfate",
  "suspension",
  "tablet",
  "tartrate",
]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapePhrase(value) {
  return cleanText(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function quotePhrase(value) {
  return `"${escapePhrase(value)}"`;
}

function joinOr(clauses) {
  if (!clauses.length) {
    return "";
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  return `(${clauses.join("+OR+")})`;
}

function buildExactFieldQuery(pairs) {
  const clauses = pairs
    .map(({ field, value }) => ({
      field: cleanText(field),
      value: cleanText(value),
    }))
    .filter(({ field, value }) => field && value)
    .map(({ field, value }) => `${field}:${quotePhrase(value)}`);

  return joinOr(clauses);
}

function normalizeToken(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isUsableShortagePhrase(value) {
  const tokens = cleanText(value)
    .split(/[^a-z0-9]+/i)
    .map(normalizeToken)
    .filter(Boolean);

  return tokens.some((token) => token.length >= 3 && !SHORTAGE_TOKEN_STOP_WORDS.has(token));
}

function buildLooseTokenFieldQuery(field, tokens) {
  const clauses = tokens
    .map(normalizeToken)
    .filter((token) => token.length >= 4)
    .map((token) => `${field}:${token}`);

  return joinOr(clauses);
}

function collectShortageIngredientTokens(genericNames) {
  const seen = new Set();
  const tokens = [];

  genericNames.forEach((genericName) => {
    cleanText(genericName)
      .split(/[\s,/]+/)
      .map(normalizeToken)
      .filter((token) => token.length >= 5 && !SHORTAGE_TOKEN_STOP_WORDS.has(token))
      .slice(0, 4)
      .forEach((token) => {
        if (seen.has(token)) {
          return;
        }

        seen.add(token);
        tokens.push(token);
      });
  });

  return tokens;
}

function buildShortageSearchQuery(candidate) {
  const exactQuery = buildExactFieldQuery([
    ...(Array.isArray(candidate?.brandNames) ? candidate.brandNames : [])
      .filter(isUsableShortagePhrase)
      .slice(0, 3)
      .map((value) => ({
        field: "proprietary_name",
        value,
      })),
    ...(Array.isArray(candidate?.genericNames) ? candidate.genericNames : [])
      .filter(isUsableShortagePhrase)
      .slice(0, 2)
      .map((value) => ({
        field: "generic_name",
        value,
      })),
  ]);

  const ingredientQuery = buildLooseTokenFieldQuery(
    "generic_name",
    collectShortageIngredientTokens(Array.isArray(candidate?.genericNames) ? candidate.genericNames : []).slice(0, 4),
  );

  const clauses = [exactQuery, ingredientQuery].filter(Boolean);

  if (!clauses.length) {
    return "";
  }

  return clauses.length === 1 ? clauses[0] : `(${clauses.join("+OR+")})`;
}

module.exports = {
  buildLooseTokenFieldQuery,
  buildShortageSearchQuery,
  collectShortageIngredientTokens,
};
