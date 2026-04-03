"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

async function withMockedFetch(mockFetch, callback) {
  const originalFetch = global.fetch;
  global.fetch = mockFetch;

  try {
    await callback();
  } finally {
    global.fetch = originalFetch;
  }
}

function loadOpenFdaModule() {
  delete require.cache[require.resolve("../lib/server/openfda")];
  return require("../lib/server/openfda");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("searchNdcRecords reuses the same in-flight upstream request across identical burst traffic", async () => {
  const { searchNdcRecords } = loadOpenFdaModule();
  let upstreamCalls = 0;

  await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);
    upstreamCalls += 1;
    await wait(40);

    assert.equal(requestUrl.pathname, "/drug/ndc.json");

    return createJsonResponse({
      meta: {
        results: {
          total: 1,
          limit: 60,
          skip: 0,
        },
      },
      results: [
        {
          product_ndc: "12345-0001",
        },
      ],
    });
  }, async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => searchNdcRecords(["adderall xr 20 mg", "adderall"])),
    );

    assert.equal(results.length, 6);
    assert.equal(results[0].results[0].product_ndc, "12345-0001");
  });

  assert.equal(upstreamCalls, 1);
});

test("openFDA serves a stale cached payload when refresh fails after the fresh TTL expires", async () => {
  const { searchNdcRecords } = loadOpenFdaModule();
  const originalNow = Date.now;
  const baseNow = originalNow();
  let upstreamCalls = 0;

  try {
    Date.now = () => baseNow;

    await withMockedFetch(async () => {
      upstreamCalls += 1;
      return createJsonResponse({
        meta: {
          results: {
            total: 1,
            limit: 60,
            skip: 0,
          },
        },
        results: [
          {
            product_ndc: "12345-0001",
          },
        ],
      });
    }, async () => {
      const payload = await searchNdcRecords(["adderall xr 20 mg", "adderall"]);
      assert.equal(payload.results[0].product_ndc, "12345-0001");
    });

    Date.now = () => baseNow + 11 * 60 * 1000;

    await withMockedFetch(async () => {
      upstreamCalls += 1;
      return createJsonResponse(
        {
          error: {
            code: "OVER_QUERY_LIMIT",
            message: "Too many requests",
          },
        },
        429,
      );
    }, async () => {
      const payload = await searchNdcRecords(["adderall xr 20 mg", "adderall"]);
      assert.equal(payload.results[0].product_ndc, "12345-0001");
    });
  } finally {
    Date.now = originalNow;
  }

  assert.equal(upstreamCalls, 2);
});
