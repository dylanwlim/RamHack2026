"use strict";

const { buildShortageSearchQuery } = require("./openfda-shortages");

const OPENFDA_BASE_URL = "https://api.fda.gov";
const DEFAULT_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_REQUEST_CACHE_ENTRIES = 64;
const MAX_MEDICATION_QUERY_LENGTH = 120;
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
    query: sanitizeText(source.query || source.q).slice(0, MAX_MEDICATION_QUERY_LENGTH),
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

function pruneRequestCache() {
  const expiresBefore = Date.now() - CACHE_TTL_MS;

  for (const [key, cached] of REQUEST_CACHE.entries()) {
    if (cached.storedAt < expiresBefore) {
      REQUEST_CACHE.delete(key);
    }
  }

  while (REQUEST_CACHE.size > MAX_REQUEST_CACHE_ENTRIES) {
    const oldestKey = REQUEST_CACHE.keys().next().value;
    if (!oldestKey) {
      break;
    }

    REQUEST_CACHE.delete(oldestKey);
  }
}

function getCachedPayload(url) {
  pruneRequestCache();

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
  pruneRequestCache();
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
        "Medication reference request failed.",
        response.status >= 400 && response.status < 600 ? response.status : 502,
        errorCode || "openfda_http_error",
      );
    }

    setCachedPayload(url, payload);
    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw createApiError("Medication reference request timed out.", 504, "openfda_timeout");
    }

    if (error.statusCode) {
      throw error;
    }

    throw createApiError("Medication reference request failed.");
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

async function searchShortagesForCandidate(candidate) {
  const shortageSearch = buildShortageSearchQuery(candidate);
  const requestPath = "/drug/shortages.json";
  const defaultEmptyResponse = {
    meta: { results: { total: 0, limit: 0, skip: 0 } },
    results: [],
  };

  if (!shortageSearch) {
    return {
      ...defaultEmptyResponse,
    };
  }

  return fetchOpenFdaJson(requestPath, { search: shortageSearch, limit: "20" });
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
