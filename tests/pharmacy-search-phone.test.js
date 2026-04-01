"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { searchNearbyPharmacies } = require("../api/_lib/pharmacy-search");

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

test("searchNearbyPharmacies enriches shortlisted results with Google phone details", async () => {
  const detailRequests = [];

  await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);

    if (requestUrl.pathname.endsWith("/nearbysearch/json")) {
      assert.equal(requestUrl.searchParams.get("type"), "pharmacy");
      assert.equal(requestUrl.searchParams.get("keyword"), "pharmacy");

      return createJsonResponse({
        status: "OK",
        results: [
          {
            place_id: "pharmacy-1",
            name: "Best Pharmacy",
            vicinity: "1 Main St, Brooklyn, NY",
            geometry: {
              location: {
                lat: 40.001,
                lng: -73,
              },
            },
            opening_hours: {
              open_now: true,
            },
            rating: 4.8,
            user_ratings_total: 220,
          },
          {
            place_id: "pharmacy-2",
            name: "Backup Pharmacy",
            vicinity: "9 Main St, Brooklyn, NY",
            geometry: {
              location: {
                lat: 40.01,
                lng: -73,
              },
            },
            opening_hours: {
              open_now: false,
            },
            rating: 4.1,
            user_ratings_total: 48,
          },
        ],
      });
    }

    if (requestUrl.pathname.endsWith("/details/json")) {
      detailRequests.push(requestUrl);
      assert.equal(
        requestUrl.searchParams.get("fields"),
        "formatted_phone_number,international_phone_number,place_id",
      );

      const placeId = requestUrl.searchParams.get("place_id");

      if (placeId === "pharmacy-1") {
        return createJsonResponse({
          status: "OK",
          result: {
            place_id: "pharmacy-1",
            formatted_phone_number: "(212) 555-0100",
            international_phone_number: "+1 212-555-0100",
          },
        });
      }

      if (placeId === "pharmacy-2") {
        return createJsonResponse({
          status: "OK",
          result: {
            place_id: "pharmacy-2",
            international_phone_number: "+1 212-555-0199",
          },
        });
      }
    }

    throw new Error(`Unexpected Google URL: ${requestUrl.toString()}`);
  }, async () => {
    const result = await searchNearbyPharmacies({
      medication: "Adderall XR 20 mg",
      medicationProfileKey: "controlled_stimulant",
      center: {
        lat: 40,
        lng: -73,
      },
      radiusMiles: 5,
      onlyOpenNow: false,
      apiKey: "test-google-key",
      sortBy: "distance",
    });

    assert.equal(result.results.length, 2);
    assert.equal(result.recommended?.name, "Best Pharmacy");
    assert.equal(result.recommended?.phone_number, "(212) 555-0100");
    assert.equal(result.recommended?.international_phone_number, "+1 212-555-0100");
    assert.equal(result.recommended?.phone_link, "tel:+12125550100");
    assert.equal(result.results[1].phone_number, "+1 212-555-0199");
    assert.equal(result.results[1].international_phone_number, "+1 212-555-0199");
    assert.equal(result.results[1].phone_link, "tel:+12125550199");
  });

  assert.equal(detailRequests.length, 2);
});

test("searchNearbyPharmacies keeps results usable when Google has no phone details", async () => {
  await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);

    if (requestUrl.pathname.endsWith("/nearbysearch/json")) {
      return createJsonResponse({
        status: "OK",
        results: [
          {
            place_id: "pharmacy-no-phone",
            name: "No Phone Pharmacy",
            vicinity: "44 Side St, Brooklyn, NY",
            geometry: {
              location: {
                lat: 40.002,
                lng: -73.001,
              },
            },
            opening_hours: {
              open_now: true,
            },
            rating: 4.4,
            user_ratings_total: 18,
          },
        ],
      });
    }

    if (requestUrl.pathname.endsWith("/details/json")) {
      return createJsonResponse({
        status: "NOT_FOUND",
      });
    }

    throw new Error(`Unexpected Google URL: ${requestUrl.toString()}`);
  }, async () => {
    const result = await searchNearbyPharmacies({
      medication: "Amoxicillin 500 mg",
      medicationProfileKey: "acute_antibiotic",
      center: {
        lat: 40,
        lng: -73,
      },
      radiusMiles: 5,
      onlyOpenNow: false,
      apiKey: "test-google-key",
      sortBy: "distance",
    });

    assert.equal(result.results.length, 1);
    assert.equal(result.recommended?.name, "No Phone Pharmacy");
    assert.equal(result.recommended?.phone_number, null);
    assert.equal(result.recommended?.international_phone_number, null);
    assert.equal(result.recommended?.phone_link, null);
  });
});
