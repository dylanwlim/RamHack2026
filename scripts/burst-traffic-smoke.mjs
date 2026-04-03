import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

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
    return await callback();
  } finally {
    global.fetch = originalFetch;
  }
}

async function withMockedNow(mockNow, callback) {
  const originalNow = Date.now;
  Date.now = mockNow;

  try {
    return await callback();
  } finally {
    Date.now = originalNow;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadFreshModules() {
  const medicationModulePath = require.resolve("../lib/medications/index-store");
  const pharmacyModulePath = require.resolve("../lib/server/pharmacy-search");
  const openFdaModulePath = require.resolve("../lib/server/openfda");

  delete require.cache[medicationModulePath];
  delete require.cache[pharmacyModulePath];
  delete require.cache[openFdaModulePath];

  return {
    medications: require("../lib/medications/index-store"),
    pharmacy: require("../lib/server/pharmacy-search"),
    openFda: require("../lib/server/openfda"),
  };
}

async function runColdMedicationLookup() {
  const { medications } = loadFreshModules();
  const startedAt = performance.now();
  const payload = await medications.searchMedicationOptions("adderall xr 20 mg", { limit: 8 });

  return {
    elapsedMs: Math.round(performance.now() - startedAt),
    resultCount: payload.results.length,
  };
}

async function runPharmacyBurst() {
  const { medications, pharmacy } = loadFreshModules();
  const counts = new Map();
  const inFlight = new Map();
  const maxConcurrent = new Map();

  function record(key, delta) {
    if (delta > 0) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    inFlight.set(key, (inFlight.get(key) || 0) + delta);
    maxConcurrent.set(key, Math.max(maxConcurrent.get(key) || 0, inFlight.get(key)));
  }

  const metrics = await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);
    const pathname = requestUrl.pathname;
    const fields = requestUrl.searchParams.get("fields");
    const key = pathname.endsWith("/details/json") ? `${pathname}?fields=${fields}` : pathname;
    record(key, 1);

    try {
      if (pathname.endsWith("/autocomplete/json")) {
        await wait(40);
        return createJsonResponse({
          status: "OK",
          predictions: [
            {
              place_id: "brooklyn-place-id",
              description: "Brooklyn, NY, USA",
              structured_formatting: {
                main_text: "Brooklyn",
                secondary_text: "NY, USA",
              },
              types: ["locality", "political"],
            },
          ],
        });
      }

      if (pathname.endsWith("/nearbysearch/json")) {
        await wait(60);
        return createJsonResponse({
          status: "OK",
          results: Array.from({ length: 20 }, (_, index) => ({
            place_id: `pharmacy-${index + 1}`,
            name: `Pharmacy ${index + 1}`,
            vicinity: `${index + 1} Main St, Brooklyn, NY`,
            geometry: {
              location: {
                lat: 40.6782 + index * 0.002,
                lng: -73.9442 - index * 0.002,
              },
            },
            opening_hours: {
              open_now: index % 2 === 0,
            },
            rating: 4.8 - index * 0.05,
            user_ratings_total: 220 - index,
          })),
        });
      }

      if (pathname.endsWith("/details/json")) {
        await wait(fields.includes("formatted_phone_number") ? 80 : 50);

        if (fields.includes("formatted_phone_number")) {
          const suffix = String(requestUrl.searchParams.get("place_id").split("-")[1]).padStart(4, "0");
          return createJsonResponse({
            status: "OK",
            result: {
              place_id: requestUrl.searchParams.get("place_id"),
              formatted_phone_number: `(212) 555-${suffix}`,
              international_phone_number: `+1 212-555-${suffix}`,
            },
          });
        }

        return createJsonResponse({
          status: "OK",
          result: {
            place_id: "brooklyn-place-id",
            name: "Brooklyn",
            formatted_address: "Brooklyn, NY, USA",
            geometry: {
              location: {
                lat: 40.6782,
                lng: -73.9442,
              },
            },
            address_components: [
              {
                long_name: "Brooklyn",
                short_name: "Brooklyn",
                types: ["locality", "political"],
              },
              {
                long_name: "New York",
                short_name: "NY",
                types: ["administrative_area_level_1", "political"],
              },
              {
                long_name: "United States",
                short_name: "US",
                types: ["country", "political"],
              },
            ],
            types: ["locality", "political"],
          },
        });
      }

      throw new Error(`Unexpected Google URL: ${requestUrl.toString()}`);
    } finally {
      record(key, -1);
    }
  }, async () => {
    const startedAt = performance.now();
    const requests = Array.from({ length: 8 }, async () => {
      const [medicationProfile, location] = await Promise.all([
        medications.resolveMedicationProfile("Adderall XR 20 mg"),
        pharmacy.resolveLocationInput({ query: "Brooklyn, NY" }, "test-google-key"),
      ]);

      return pharmacy.searchNearbyPharmacies({
        medication: medicationProfile.canonicalLabel,
        medicationProfileKey: medicationProfile.workflowCategory,
        center: location.coordinates,
        radiusMiles: 5,
        onlyOpenNow: false,
        apiKey: "test-google-key",
        sortBy: "distance",
      });
    });

    const results = await Promise.allSettled(requests);
    return {
      elapsedMs: Math.round(performance.now() - startedAt),
      failures: results.filter((result) => result.status === "rejected").length,
    };
  });

  return {
    ...metrics,
    upstreamCalls: Object.fromEntries([...counts.entries()].sort()),
    maxConcurrent: Object.fromEntries([...maxConcurrent.entries()].sort()),
  };
}

async function runPharmacyWarmCacheFallback() {
  const { pharmacy } = loadFreshModules();
  const baseNow = Date.now();
  let upstreamCalls = 0;
  let secondPhaseCalls = 0;

  await withMockedNow(
    () => baseNow,
    () =>
      withMockedFetch(async (url) => {
        const requestUrl = new URL(url);
        upstreamCalls += 1;

        if (requestUrl.pathname.endsWith("/nearbysearch/json")) {
          return createJsonResponse({
            status: "OK",
            results: [
              {
                place_id: "pharmacy-1",
                name: "Best Pharmacy",
                vicinity: "1 Main St, Brooklyn, NY",
                geometry: {
                  location: {
                    lat: 40.6782,
                    lng: -73.9442,
                  },
                },
                opening_hours: {
                  open_now: true,
                },
                rating: 4.8,
                user_ratings_total: 220,
              },
            ],
          });
        }

        if (requestUrl.pathname.endsWith("/details/json")) {
          return createJsonResponse({
            status: "OK",
            result: {
              place_id: "pharmacy-1",
              formatted_phone_number: "(212) 555-0100",
              international_phone_number: "+1 212-555-0100",
            },
          });
        }

        throw new Error(`Unexpected Google URL: ${requestUrl.toString()}`);
      }, async () => {
        await pharmacy.searchNearbyPharmacies({
          medication: "Adderall XR 20 mg",
          medicationProfileKey: "controlled_stimulant",
          center: {
            lat: 40.6782,
            lng: -73.9442,
          },
          radiusMiles: 5,
          onlyOpenNow: false,
          apiKey: "test-google-key",
          sortBy: "distance",
        });
      }),
  );

  const recovered = await withMockedNow(
    () => baseNow + 3 * 60 * 1000,
    () =>
      withMockedFetch(async (url) => {
        secondPhaseCalls += 1;
        const requestUrl = new URL(url);

        return createJsonResponse({
          status: "OVER_QUERY_LIMIT",
          error_message: `Rate limited for ${requestUrl.pathname}`,
        });
      }, async () => {
        return pharmacy.searchNearbyPharmacies({
          medication: "Adderall XR 20 mg",
          medicationProfileKey: "controlled_stimulant",
          center: {
            lat: 40.6782,
            lng: -73.9442,
          },
          radiusMiles: 5,
          onlyOpenNow: false,
          apiKey: "test-google-key",
          sortBy: "distance",
        });
      }),
  );

  return {
    upstreamCalls,
    secondPhaseCalls,
    recoveredRecommendedName: recovered.recommended?.name || null,
    recoveredPhoneNumber: recovered.recommended?.phone_number || null,
  };
}

async function runDrugBurst() {
  const { openFda } = loadFreshModules();
  const counts = new Map();
  const inFlight = new Map();
  const maxConcurrent = new Map();

  function record(key, delta) {
    if (delta > 0) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    inFlight.set(key, (inFlight.get(key) || 0) + delta);
    maxConcurrent.set(key, Math.max(maxConcurrent.get(key) || 0, inFlight.get(key)));
  }

  const metrics = await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);
    const key = requestUrl.toString();
    record(key, 1);

    try {
      await wait(40);
      return createJsonResponse({
        meta: {
          results: {
            total: 1,
            limit: 20,
            skip: 0,
          },
        },
        results: [
          {
            product_ndc: "12345-0001",
            generic_name: "amphetamine",
          },
        ],
      });
    } finally {
      record(key, -1);
    }
  }, async () => {
    const startedAt = performance.now();
    const requests = Array.from({ length: 8 }, () =>
      openFda.searchNdcRecords(["adderall xr 20 mg", "adderall"]),
    );

    const results = await Promise.allSettled(requests);
    return {
      elapsedMs: Math.round(performance.now() - startedAt),
      failures: results.filter((result) => result.status === "rejected").length,
    };
  });

  return {
    ...metrics,
    totalUpstreamCalls: [...counts.values()].reduce((sum, value) => sum + value, 0),
    uniqueUpstreamRequests: counts.size,
    maxConcurrentPerRequest: Math.max(0, ...maxConcurrent.values()),
  };
}

async function runOpenFdaStaleFallback() {
  const { openFda } = loadFreshModules();
  const baseNow = Date.now();
  let upstreamCalls = 0;

  await withMockedNow(
    () => baseNow,
    () =>
      withMockedFetch(async () => {
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
        await openFda.searchNdcRecords(["adderall xr 20 mg", "adderall"]);
      }),
  );

  const recovered = await withMockedNow(
    () => baseNow + 11 * 60 * 1000,
    () =>
      withMockedFetch(async () => {
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
        return openFda.searchNdcRecords(["adderall xr 20 mg", "adderall"]);
      }),
  );

  return {
    upstreamCalls,
    recoveredProductNdc: recovered.results[0]?.product_ndc || null,
  };
}

async function main() {
  const results = {
    coldMedicationLookup: await runColdMedicationLookup(),
    pharmacyBurst: await runPharmacyBurst(),
    pharmacyWarmCacheFallback: await runPharmacyWarmCacheFallback(),
    drugBurst: await runDrugBurst(),
    openFdaStaleFallback: await runOpenFdaStaleFallback(),
  };

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
