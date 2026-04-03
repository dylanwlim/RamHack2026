"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MISSING_GOOGLE_API_KEY_CODE,
  createGoogleApiUnavailablePayload,
  getGoogleApiKey,
  getGoogleApiRuntimeMetadata,
} = require("../lib/server/google-api-config");

test("google api config trims the server key and reports runtime metadata", () => {
  const originalGoogleApiKey = process.env.GOOGLE_API_KEY;
  const originalVercel = process.env.VERCEL;
  const originalVercelEnv = process.env.VERCEL_ENV;

  process.env.GOOGLE_API_KEY = "  test-google-key  ";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "preview";

  try {
    assert.equal(getGoogleApiKey(), "test-google-key");
    assert.deepEqual(getGoogleApiRuntimeMetadata(), {
      runtime: "vercel",
      nodeEnv: process.env.NODE_ENV || null,
      vercelEnv: "preview",
      hasGoogleApiKey: true,
    });
  } finally {
    if (originalGoogleApiKey === undefined) {
      delete process.env.GOOGLE_API_KEY;
    } else {
      process.env.GOOGLE_API_KEY = originalGoogleApiKey;
    }

    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }

    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  }
});

test("google api unavailable payload exposes a stable diagnostic code", () => {
  assert.deepEqual(
    createGoogleApiUnavailablePayload("Location suggestions are temporarily unavailable."),
    {
      error: "Location suggestions are temporarily unavailable.",
      code: MISSING_GOOGLE_API_KEY_CODE,
    },
  );
});
