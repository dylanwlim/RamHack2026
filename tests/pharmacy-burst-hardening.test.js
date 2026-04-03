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

function loadPharmacySearch() {
  delete require.cache[require.resolve("../lib/server/pharmacy-search")];
  return require("../lib/server/pharmacy-search");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("searchNearbyPharmacies coalesces identical burst traffic and caps phone-detail fanout", async () => {
  const { searchNearbyPharmacies } = loadPharmacySearch();
  const counts = new Map();
  const inFlight = new Map();
  const maxConcurrent = new Map();

  function track(key, delta) {
    counts.set(key, (counts.get(key) || 0) + (delta > 0 ? 1 : 0));
    inFlight.set(key, (inFlight.get(key) || 0) + delta);
    maxConcurrent.set(key, Math.max(maxConcurrent.get(key) || 0, inFlight.get(key)));
  }

  await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);
    const pathname = requestUrl.pathname;
    const fields = requestUrl.searchParams.get("fields");
    const key = pathname.endsWith("/details/json") ? `${pathname}?fields=${fields}` : pathname;
    track(key, 1);

    try {
      if (pathname.endsWith("/nearbysearch/json")) {
        await wait(40);
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
        await wait(60);
        return createJsonResponse({
          status: "OK",
          result: {
            place_id: requestUrl.searchParams.get("place_id"),
            formatted_phone_number: "(212) 555-0100",
            international_phone_number: "+1 212-555-0100",
          },
        });
      }

      throw new Error(`Unexpected Google URL: ${requestUrl.toString()}`);
    } finally {
      track(key, -1);
    }
  }, async () => {
    const requests = Array.from({ length: 4 }, () =>
      searchNearbyPharmacies({
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
      }),
    );

    const results = await Promise.all(requests);
    assert.equal(results.length, 4);
    assert.equal(results[0].results.length, 20);
  });

  const phoneDetailsKey =
    "/maps/api/place/details/json?fields=formatted_phone_number,international_phone_number,opening_hours,place_id,utc_offset";

  assert.equal(counts.get("/maps/api/place/nearbysearch/json"), 1);
  assert.equal(counts.get(phoneDetailsKey), 20);
  assert.ok((maxConcurrent.get(phoneDetailsKey) || 0) <= 6);
});

test("resolveLocationInput falls back to the freeform query when a supplied place ID cannot be resolved", async () => {
  const { resolveLocationInput } = loadPharmacySearch();
  const requestPaths = [];

  await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);
    requestPaths.push(requestUrl.pathname);

    if (
      requestUrl.pathname.endsWith("/details/json") &&
      requestUrl.searchParams.get("fields") ===
        "address_component,formatted_address,geometry,name,place_id,type"
    ) {
      return createJsonResponse(
        {
          status: "OVER_QUERY_LIMIT",
          error_message: "Rate limited",
        },
        200,
      );
    }

    if (requestUrl.pathname.endsWith("/geocode/json")) {
      return createJsonResponse({
        status: "OK",
        results: [
          {
            place_id: "fallback-place-id",
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
        ],
      });
    }

    if (requestUrl.pathname.endsWith("/autocomplete/json")) {
      return createJsonResponse({
        status: "ZERO_RESULTS",
        predictions: [],
      });
    }

    throw new Error(`Unexpected Google URL: ${requestUrl.toString()}`);
  }, async () => {
    const location = await resolveLocationInput(
      {
        query: "Brooklyn, NY",
        placeId: "broken-place-id",
      },
      "test-google-key",
    );

    assert.equal(location.place_id, "fallback-place-id");
    assert.equal(location.resolution_source, "geocode");
    assert.equal(location.city, "Brooklyn");
    assert.equal(location.state, "NY");
  });

  assert.deepEqual(requestPaths, [
    "/maps/api/place/details/json",
    "/maps/api/place/autocomplete/json",
    "/maps/api/geocode/json",
  ]);
});
