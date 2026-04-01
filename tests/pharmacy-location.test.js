"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  autocompleteLocationSuggestions,
  getSearchInput,
  resolveLocationInput,
} = require("../lib/server/pharmacy-search");

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

test("getSearchInput preserves optional location place IDs from GET and POST requests", () => {
  const postInput = getSearchInput(
    {
      method: "POST",
    },
    {
      medication: "Adderall XR 20 mg",
      location: "Brooklyn, NY",
      locationPlaceId: "ChIJCSF8lBZEwokRhngABHRcdoI",
      radiusMiles: "10",
      onlyOpenNow: "true",
      sortBy: "distance",
    },
  );

  assert.equal(postInput.locationPlaceId, "ChIJCSF8lBZEwokRhngABHRcdoI");
  assert.equal(postInput.radiusMiles, 10);
  assert.equal(postInput.onlyOpenNow, true);
  assert.equal(postInput.sortBy, "distance");

  const getInput = getSearchInput(
    {
      method: "GET",
      query: {
        query: "Wegovy 0.25 mg/0.5 ml",
        location: "10019",
        location_place_id: "zip-place-id",
      },
    },
    {},
  );

  assert.equal(getInput.medication, "Wegovy 0.25 mg/0.5 ml");
  assert.equal(getInput.location, "10019");
  assert.equal(getInput.locationPlaceId, "zip-place-id");
});

test("resolveLocationInput prefers autocomplete plus place details for freeform searches", async () => {
  const requests = [];

  await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);
    requests.push(requestUrl);

    if (requestUrl.pathname.endsWith("/autocomplete/json")) {
      assert.equal(requestUrl.searchParams.get("input"), "Brooklyn, NY");

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

    if (requestUrl.pathname.endsWith("/details/json")) {
      assert.equal(requestUrl.searchParams.get("place_id"), "brooklyn-place-id");

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
  }, async () => {
    const location = await resolveLocationInput(
      {
        query: "Brooklyn, NY",
      },
      "test-google-key",
    );

    assert.equal(location.display_label, "Brooklyn, NY, USA");
    assert.equal(location.formatted_address, "Brooklyn, NY, USA");
    assert.equal(location.place_id, "brooklyn-place-id");
    assert.equal(location.city, "Brooklyn");
    assert.equal(location.state, "NY");
    assert.equal(location.country_code, "US");
    assert.equal(location.resolution_source, "place_details");
    assert.equal(location.coordinates.lat, 40.6782);
    assert.equal(location.coordinates.lng, -73.9442);
  });

  assert.equal(requests.length, 2);
});

test("resolveLocationInput resolves bare ZIP input with postal-code constrained geocoding", async () => {
  await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);

    if (requestUrl.pathname.endsWith("/geocode/json")) {
      assert.equal(requestUrl.searchParams.get("address"), "10019");
      assert.equal(requestUrl.searchParams.get("components"), "postal_code:10019|country:US");

      return createJsonResponse({
        status: "OK",
        results: [
          {
            place_id: "zip-place-id",
            formatted_address: "New York, NY 10019, USA",
            geometry: {
              location: {
                lat: 40.765,
                lng: -73.985,
              },
            },
            address_components: [
              {
                long_name: "New York",
                short_name: "New York",
                types: ["locality", "political"],
              },
              {
                long_name: "New York",
                short_name: "NY",
                types: ["administrative_area_level_1", "political"],
              },
              {
                long_name: "10019",
                short_name: "10019",
                types: ["postal_code"],
              },
              {
                long_name: "United States",
                short_name: "US",
                types: ["country", "political"],
              },
            ],
            types: ["postal_code"],
          },
        ],
      });
    }

    throw new Error(`Unexpected Google URL: ${requestUrl.toString()}`);
  }, async () => {
    const location = await resolveLocationInput(
      {
        query: "10019",
      },
      "test-google-key",
    );

    assert.equal(location.display_label, "New York, NY 10019, USA");
    assert.equal(location.place_id, "zip-place-id");
    assert.equal(location.city, "New York");
    assert.equal(location.state, "NY");
    assert.equal(location.postal_code, "10019");
    assert.equal(location.resolution_source, "geocode");
  });
});

test("autocompleteLocationSuggestions prioritizes exact ZIP matches over street-number noise", async () => {
  await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);

    if (requestUrl.pathname.endsWith("/geocode/json")) {
      assert.equal(requestUrl.searchParams.get("address"), "32751");
      assert.equal(requestUrl.searchParams.get("components"), "postal_code:32751|country:US");

      return createJsonResponse({
        status: "OK",
        results: [
          {
            place_id: "zip-32751",
            formatted_address: "Maitland, FL 32751, USA",
            geometry: {
              location: {
                lat: 28.6306,
                lng: -81.3656,
              },
            },
            address_components: [
              {
                long_name: "Maitland",
                short_name: "Maitland",
                types: ["locality", "political"],
              },
              {
                long_name: "Florida",
                short_name: "FL",
                types: ["administrative_area_level_1", "political"],
              },
              {
                long_name: "32751",
                short_name: "32751",
                types: ["postal_code"],
              },
              {
                long_name: "United States",
                short_name: "US",
                types: ["country", "political"],
              },
            ],
            types: ["postal_code"],
          },
        ],
      });
    }

    if (requestUrl.pathname.endsWith("/autocomplete/json")) {
      assert.equal(requestUrl.searchParams.get("input"), "32751");

      return createJsonResponse({
        status: "OK",
        predictions: [
          {
            place_id: "noise-1",
            description: "32751 Kensington Ct, Frankford, DE, USA",
            structured_formatting: {
              main_text: "32751 Kensington Ct",
              secondary_text: "Frankford, DE, USA",
            },
            types: ["street_address"],
          },
          {
            place_id: "zip-google",
            description: "32751, Maitland, FL, USA",
            structured_formatting: {
              main_text: "32751",
              secondary_text: "Maitland, FL, USA",
            },
            types: ["postal_code"],
          },
          {
            place_id: "noise-2",
            description: "32751 Watchtower Drive, Selbyville, DE, USA",
            structured_formatting: {
              main_text: "32751 Watchtower Drive",
              secondary_text: "Selbyville, DE, USA",
            },
            types: ["street_address"],
          },
        ],
      });
    }

    throw new Error(`Unexpected Google URL: ${requestUrl.toString()}`);
  }, async () => {
    const suggestions = await autocompleteLocationSuggestions("32751", "test-google-key", {
      limit: 8,
    });

    assert.equal(suggestions[0].primary_text, "32751");
    assert.equal(suggestions[0].type_label, "ZIP");
    assert.ok(suggestions.every((suggestion) => suggestion.place_id !== "noise-1"));
    assert.ok(suggestions.every((suggestion) => suggestion.place_id !== "noise-2"));
  });
});

test("resolveLocationInput falls back to geocoding when autocomplete has no usable result", async () => {
  await withMockedFetch(async (url) => {
    const requestUrl = new URL(url);

    if (requestUrl.pathname.endsWith("/autocomplete/json")) {
      assert.equal(requestUrl.searchParams.get("input"), "350 5th Ave, New York, NY 10118");

      return createJsonResponse({
        status: "ZERO_RESULTS",
        predictions: [],
      });
    }

    if (requestUrl.pathname.endsWith("/geocode/json")) {
      assert.equal(requestUrl.searchParams.get("address"), "350 5th Ave, New York, NY 10118");
      assert.equal(requestUrl.searchParams.get("components"), null);

      return createJsonResponse({
        status: "OK",
        results: [
          {
            place_id: "empire-state-place-id",
            formatted_address: "350 5th Ave, New York, NY 10118, USA",
            geometry: {
              location: {
                lat: 40.74844,
                lng: -73.985664,
              },
            },
            address_components: [
              {
                long_name: "350",
                short_name: "350",
                types: ["street_number"],
              },
              {
                long_name: "5th Avenue",
                short_name: "5th Ave",
                types: ["route"],
              },
              {
                long_name: "New York",
                short_name: "New York",
                types: ["locality", "political"],
              },
              {
                long_name: "New York",
                short_name: "NY",
                types: ["administrative_area_level_1", "political"],
              },
              {
                long_name: "10118",
                short_name: "10118",
                types: ["postal_code"],
              },
              {
                long_name: "United States",
                short_name: "US",
                types: ["country", "political"],
              },
            ],
            types: ["street_address"],
          },
        ],
      });
    }

    throw new Error(`Unexpected Google URL: ${requestUrl.toString()}`);
  }, async () => {
    const location = await resolveLocationInput(
      {
        query: "350 5th Ave, New York, NY 10118",
      },
      "test-google-key",
    );

    assert.equal(location.display_label, "350 5th Ave, New York, NY 10118, USA");
    assert.equal(location.place_id, "empire-state-place-id");
    assert.equal(location.city, "New York");
    assert.equal(location.state, "NY");
    assert.equal(location.route, "5th Avenue");
    assert.equal(location.street_number, "350");
    assert.equal(location.resolution_source, "geocode");
  });
});
