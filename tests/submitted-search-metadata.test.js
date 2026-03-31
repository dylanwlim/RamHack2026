const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMedicationProfileFromSubmittedSearch,
  buildResolvedLocationFromSubmittedSearch,
} = require("../lib/search/submitted-search-metadata");

test("submitted search metadata builds an openFDA medication profile without index resolution", () => {
  const profile = buildMedicationProfileFromSubmittedSearch(
    {
      medication: "Custom Therapy",
    },
    {
      medicationSource: "openfda",
      medicationWorkflowCategory: "cold_chain",
      medicationLabel: "Custom Therapy Injection",
      medicationSelectedStrength: "2 mg/mL",
      medicationDosageForm: "injection",
      medicationFormulation: "Extended release",
    },
  );

  assert.deepEqual(profile, {
    canonicalLabel: "Custom Therapy",
    workflowCategory: "cold_chain",
    source: "openfda",
    demoOnly: false,
    demoNote: null,
    simulatedUserCount: null,
    medicationLabel: "Custom Therapy Injection",
    selectedStrength: "2 mg/mL",
    dosageForm: "injection",
    formulation: "Extended release",
  });
});

test("submitted search metadata rebuilds a demo medication profile without index resolution", () => {
  const profile = buildMedicationProfileFromSubmittedSearch(
    {
      medication: "Vellocet ER 20 mg",
    },
    {
      medicationSource: "demo",
      medicationSelectedStrength: "20 mg",
    },
  );

  assert.equal(profile?.canonicalLabel, "Vellocet ER 20 mg");
  assert.equal(profile?.workflowCategory, "maintenance_refill");
  assert.equal(profile?.source, "demo");
  assert.equal(profile?.demoOnly, true);
  assert.equal(profile?.selectedStrength, "20 mg");
  assert.equal(profile?.medicationLabel, "Vellocet ER");
});

test("submitted search metadata returns null when openFDA workflow metadata is missing", () => {
  const profile = buildMedicationProfileFromSubmittedSearch(
    {
      medication: "Custom Therapy",
    },
    {
      medicationSource: "openfda",
      medicationLabel: "Custom Therapy Injection",
    },
  );

  assert.equal(profile, null);
});

test("submitted search metadata builds a resolved location from client coordinates", () => {
  const location = buildResolvedLocationFromSubmittedSearch(
    {
      location: "New York, NY 10001, USA",
      locationPlaceId: "resolved-place-id",
    },
    {
      locationLat: 40.7536854,
      locationLng: -73.9991637,
    },
  );

  assert.deepEqual(location, {
    raw_query: "New York, NY 10001, USA",
    display_label: "New York, NY 10001, USA",
    formatted_address: "New York, NY 10001, USA",
    name: null,
    place_id: "resolved-place-id",
    coordinates: {
      lat: 40.7536854,
      lng: -73.9991637,
    },
    types: [],
    resolution_source: "client_resolve",
    city: null,
    state: null,
    postal_code: null,
    neighborhood: null,
    country: null,
    country_code: null,
    route: null,
    street_number: null,
  });
});

test("submitted search metadata ignores missing client coordinates", () => {
  const location = buildResolvedLocationFromSubmittedSearch(
    {
      location: "10011",
      locationPlaceId: "",
    },
    {
      locationLat: null,
      locationLng: null,
    },
  );

  assert.equal(location, null);
});
