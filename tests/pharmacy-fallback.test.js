"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildUnavailableNearbyResponse,
  shouldDegradeNearbySearch,
} = require("../lib/server/nearby-search-fallback");

test("pharmacy fallback response keeps the page renderable when live nearby search is unavailable", () => {
  const payload = buildUnavailableNearbyResponse(
    {
      medication: "Adderall",
      location: "Brooklyn, NY",
      locationPlaceId: "",
      radiusMiles: 5,
      onlyOpenNow: false,
      sortBy: "best_match",
    },
    {
      canonicalLabel: "Adderall IR",
      workflowCategory: "controlled_stimulant",
      source: "openfda",
      demoOnly: false,
      demoNote: null,
      simulatedUserCount: null,
      medicationLabel: "Adderall IR",
      selectedStrength: null,
      dosageForm: "tablet",
      formulation: "Immediate release",
    },
    "Live nearby pharmacy search is unavailable in this environment.",
    "missing_google_api_key",
  );

  assert.equal(payload.status, "degraded");
  assert.equal(payload.degraded_reason, "Live nearby pharmacy search is unavailable in this environment.");
  assert.equal(payload.degraded_code, "missing_google_api_key");
  assert.equal(payload.counts.total, 0);
  assert.equal(payload.recommended, null);
  assert.equal(payload.location.display_label, "Brooklyn, NY");
  assert.equal(payload.medication_profile.workflow_label, "Higher-friction handoff");
});

test("only upstream dependency failures trigger the nearby-search degraded path", () => {
  assert.equal(shouldDegradeNearbySearch({ code: "google_api_timeout", statusCode: 504 }), true);
  assert.equal(shouldDegradeNearbySearch({ code: "places_search_failed", statusCode: 502 }), true);
  assert.equal(shouldDegradeNearbySearch({ code: "location_not_found", statusCode: 404 }), false);
  assert.equal(shouldDegradeNearbySearch({ code: "missing_location", statusCode: 400 }), false);
});
