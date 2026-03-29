"use strict";

const OPENFDA_BASE_URL = "https://api.fda.gov";
const DEFAULT_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_CACHE = new Map();

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getQueryInput(req) {
  const source = req.query || {};
  return {
    query: sanitizeText(source.query || source.q),
  };
}

function createApiError(message, statusCode = 502, code = "openfda_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getCacheKey(url) {
  return url.toString();
}

function getCachedPayload(url) {
  const key = getCacheKey(url);
  const cached = REQUEST_CACHE.get(key);

  if (!cached) {
    return null;
  }

  if (Date.now() - cached.storedAt > CACHE_TTL_MS) {
    REQUEST_CACHE.delete(key);
    return null;
  }

  return cached.payload;
}

function setCachedPayload(url, payload) {
  REQUEST_CACHE.set(getCacheKey(url), {
    storedAt: Date.now(),
    payload,
  });
}

function escapePhrase(value) {
  return sanitizeText(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
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

function buildPhraseFieldQuery(fields, phrases) {
  const phraseClauses = phrases
    .map((phrase) => sanitizeText(phrase))
    .filter(Boolean)
    .map((phrase) =>
      joinOr(
        fields.map((field) => `${field}:${quotePhrase(phrase)}`),
      ),
    );

  return joinOr(phraseClauses);
}

function buildExactFieldQuery(pairs) {
  const clauses = pairs
    .map(({ field, value }) => ({
      field: sanitizeText(field),
      value: sanitizeText(value),
    }))
    .filter(({ field, value }) => field && value)
    .map(({ field, value }) => `${field}:${quotePhrase(value)}`);

  return joinOr(clauses);
}

// Builds unquoted token clauses — openFDA Elasticsearch matches the token
// anywhere within the field value, so generic_name:semaglutide matches
// "Semaglutide Injection" without needing the exact full string.
function buildTokenFieldQuery(field, tokens) {
  const clauses = tokens
    .map((t) => sanitizeText(t).toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 4)
    .map((t) => `${field}:${t}`);

  return joinOr(clauses);
}

function getOpenFdaApiKey() {
  return sanitizeText(process.env.OPENFDA_API_KEY || process.env.FDA_API_KEY);
}

async function fetchOpenFdaJson(pathname, params = {}) {
  const url = new URL(pathname, OPENFDA_BASE_URL);
  const apiKey = getOpenFdaApiKey();
  const queryPairs = [];

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    const encodedValue =
      key === "search" || key === "count"
        ? encodeURIComponent(value).replace(/%2B/g, "+")
        : encodeURIComponent(value);

    queryPairs.push(`${encodeURIComponent(key)}=${encodedValue}`);
  });

  if (apiKey) {
    queryPairs.push(`api_key=${encodeURIComponent(apiKey)}`);
  }

  url.search = queryPairs.join("&");

  const cached = getCachedPayload(url);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const errorCode = payload?.error?.code;

      if (response.status === 404 && errorCode === "NOT_FOUND") {
        const emptyPayload = {
          meta: {
            results: {
              total: 0,
              limit: Number(params.limit || 0),
              skip: 0,
            },
          },
          results: [],
        };
        setCachedPayload(url, emptyPayload);
        return emptyPayload;
      }

      throw createApiError(
        payload?.error?.message || `openFDA request failed with HTTP ${response.status}.`,
        response.status >= 400 && response.status < 600 ? response.status : 502,
        errorCode || "openfda_http_error",
      );
    }

    setCachedPayload(url, payload);
    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw createApiError("openFDA request timed out.", 504, "openfda_timeout");
    }

    if (error.statusCode) {
      throw error;
    }

    throw createApiError(error.message || "openFDA request failed.");
  } finally {
    clearTimeout(timeout);
  }
}

async function searchNdcRecords(searchPhrases) {
  const phraseQuery = buildPhraseFieldQuery(
    [
      "brand_name",
      "brand_name_base",
      "generic_name",
      "openfda.brand_name",
      "openfda.generic_name",
      "openfda.substance_name",
    ],
    searchPhrases,
  );

  if (!phraseQuery) {
    return {
      meta: { results: { total: 0, limit: 0, skip: 0 } },
      results: [],
    };
  }

  return fetchOpenFdaJson("/drug/ndc.json", {
    search: `(${phraseQuery}+AND+finished:true+AND+product_type:${quotePhrase(
      "HUMAN PRESCRIPTION DRUG",
    )})`,
    limit: "60",
  });
}

async function searchDrugApplications(searchPhrases) {
  const phraseQuery = buildPhraseFieldQuery(
    [
      "products.brand_name",
      "openfda.brand_name",
      "openfda.generic_name",
      "openfda.substance_name",
    ],
    searchPhrases,
  );

  if (!phraseQuery) {
    return {
      meta: { results: { total: 0, limit: 0, skip: 0 } },
      results: [],
    };
  }

  return fetchOpenFdaJson("/drug/drugsfda.json", {
    search: phraseQuery,
    limit: "20",
  });
}

// FDA shortage records store the full multi-ingredient chemical string in
// generic_name (e.g. "Amphetamine Aspartate Monohydrate, Amphetamine Sulfate,
// Dextroamphetamine Saccharate...") with no proprietary_name. Exact-phrase
// matching on a short display name like "Adderall" or "Dextroamp Saccharate"
// won't hit those records. We extract the longest meaningful active ingredient
// token from each generic name and add it as an additional search term so
// openFDA's full-text search within the field value finds the records.
function extractActiveIngredientTokens(genericNames) {
  const stopWords = new Set(["and", "or", "with", "for", "the"]);
  const seen = new Set();
  const tokens = [];

  genericNames.forEach((name) => {
    sanitizeText(name)
      .split(/[\s,/]+/)
      .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
      .filter((w) => w.length >= 6 && !stopWords.has(w))
      .slice(0, 2)
      .forEach((w) => {
        if (!seen.has(w)) {
          seen.add(w);
          tokens.push(w);
        }
      });
  });

  return tokens;
}

async function searchShortagesForCandidate(candidate) {
  const activeIngredientTokens = extractActiveIngredientTokens(candidate.genericNames);

  // Exact-phrase clauses for proprietary_name and full generic_name strings
  const exactSearch = buildExactFieldQuery([
    ...candidate.brandNames.slice(0, 3).map((value) => ({
      field: "proprietary_name",
      value,
    })),
    ...candidate.genericNames.slice(0, 2).map((value) => ({
      field: "generic_name",
      value,
    })),
  ]);

  // Unquoted token clauses — matches the ingredient word anywhere inside the
  // FDA's verbose multi-ingredient generic_name string, e.g.:
  //   "semaglutide" matches "Semaglutide Injection"
  //   "dextroamphetamine" matches "Dextroamphetamine Saccharate..."
  const tokenSearch = buildTokenFieldQuery("generic_name", activeIngredientTokens.slice(0, 4));

  const clauses = [exactSearch, tokenSearch].filter(Boolean);
  const search = clauses.length > 1 ? `(${clauses.join("+OR+")})` : clauses[0] || "";

  if (!search) {
    return {
      meta: { results: { total: 0, limit: 0, skip: 0 } },
      results: [],
    };
  }

  return fetchOpenFdaJson("/drug/shortages.json", {
    search,
    limit: "20",
  });
}

async function searchRecallsForCandidate(candidate) {
  const identifyingPairs = [
    ...candidate.applicationNumbers.slice(0, 3).map((value) => ({
      field: "openfda.application_number",
      value,
    })),
    ...candidate.productNdcs.slice(0, 5).map((value) => ({
      field: "openfda.product_ndc",
      value,
    })),
    ...candidate.brandNames.slice(0, 2).map((value) => ({
      field: "openfda.brand_name",
      value,
    })),
  ];
  const search = buildExactFieldQuery(
    identifyingPairs.length
      ? identifyingPairs
      : candidate.genericNames.slice(0, 1).map((value) => ({
          field: "openfda.generic_name",
          value,
        })),
  );

  if (!search) {
    return {
      meta: { results: { total: 0, limit: 0, skip: 0 } },
      results: [],
    };
  }

  return fetchOpenFdaJson("/drug/enforcement.json", {
    search,
    limit: "12",
  });
}

module.exports = {
  createApiError,
  getOpenFdaApiKey,
  getQueryInput,
  searchDrugApplications,
  searchNdcRecords,
  searchRecallsForCandidate,
  searchShortagesForCandidate,
  sendJson,
};
