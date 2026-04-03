"use strict";

const GOOGLE_API_KEY_ENV_NAME = "GOOGLE_API_KEY";
const MISSING_GOOGLE_API_KEY_CODE = "missing_google_api_key";

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getGoogleApiKey() {
  return sanitizeText(process.env[GOOGLE_API_KEY_ENV_NAME]) || null;
}

function getRuntimeName() {
  if (sanitizeText(process.env.VERCEL)) {
    return "vercel";
  }

  if (sanitizeText(process.env.CF_PAGES) || sanitizeText(process.env.CLOUDFLARE_ACCOUNT_ID)) {
    return "cloudflare";
  }

  return "node";
}

function getGoogleApiRuntimeMetadata() {
  return {
    runtime: getRuntimeName(),
    nodeEnv: sanitizeText(process.env.NODE_ENV) || null,
    vercelEnv: sanitizeText(process.env.VERCEL_ENV) || null,
    hasGoogleApiKey: Boolean(getGoogleApiKey()),
  };
}

function createGoogleApiUnavailablePayload(error) {
  return {
    error,
    code: MISSING_GOOGLE_API_KEY_CODE,
  };
}

function logGoogleApiConfigurationError(scope, metadata = {}) {
  console.error(`[${scope}] missing GOOGLE_API_KEY`, {
    ...getGoogleApiRuntimeMetadata(),
    code: MISSING_GOOGLE_API_KEY_CODE,
    ...metadata,
  });
}

function summarizeGoogleApiError(error) {
  return {
    code: sanitizeText(error?.code) || null,
    message: sanitizeText(error?.message) || null,
    statusCode: typeof error?.statusCode === "number" ? error.statusCode : null,
  };
}

function logGoogleApiRequestError(scope, error, metadata = {}) {
  console.error(`[${scope}] location service failure`, {
    ...getGoogleApiRuntimeMetadata(),
    ...summarizeGoogleApiError(error),
    ...metadata,
  });
}

module.exports = {
  MISSING_GOOGLE_API_KEY_CODE,
  createGoogleApiUnavailablePayload,
  getGoogleApiKey,
  getGoogleApiRuntimeMetadata,
  logGoogleApiConfigurationError,
  logGoogleApiRequestError,
};
