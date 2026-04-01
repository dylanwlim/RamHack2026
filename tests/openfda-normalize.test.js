"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMedicationLookupKeys,
  buildCandidateContexts,
  buildDrugIntelligencePayload,
  buildSearchPhrases,
  pickFeaturedMatch,
} = require("../lib/server/openfda-normalize");

test("buildSearchPhrases keeps the raw query and release-aware lookup fallbacks", () => {
  assert.deepEqual(buildSearchPhrases("Adderall XR 20 mg"), [
    "Adderall XR 20 mg",
    "Adderall XR",
    "Adderall",
    "Adderall ER",
  ]);
});

test("buildMedicationLookupKeys strips dosage-heavy labels down to a searchable family", () => {
  assert.deepEqual(buildMedicationLookupKeys("Wegovy 0.25 mg/0.5 ml"), [
    "Wegovy 0.25 mg/0.5 ml",
    "Wegovy",
  ]);

  assert.deepEqual(buildMedicationLookupKeys("Adderall 30 mg extended-release capsule"), [
    "Adderall 30 mg extended-release capsule",
    "Adderall XR",
    "Adderall",
    "Adderall ER",
    "Adderall extended-release",
    "Adderall extended-release capsule",
  ]);
});

test("buildCandidateContexts groups listings by application number", () => {
  const ndcPayload = {
    results: [
      {
        application_number: "NDA000001",
        brand_name: "ExampleMed",
        generic_name: "example ingredient",
        labeler_name: "Alpha Labs",
        dosage_form: "TABLET",
        route: ["ORAL"],
        active_ingredients: [{ strength: "10 mg" }],
        product_ndc: "11111-111",
        listing_expiration_date: "20991231",
        finished: true,
        product_type: "HUMAN PRESCRIPTION DRUG",
      },
      {
        application_number: "NDA000001",
        brand_name: "ExampleMed",
        generic_name: "example ingredient",
        labeler_name: "Alpha Labs",
        dosage_form: "TABLET",
        route: ["ORAL"],
        active_ingredients: [{ strength: "20 mg" }],
        product_ndc: "11111-112",
        listing_expiration_date: "20991231",
        finished: true,
        product_type: "HUMAN PRESCRIPTION DRUG",
      },
    ],
  };

  const approvalsPayload = {
    results: [
      {
        application_number: "NDA000001",
        sponsor_name: "Alpha Labs",
        products: [
          {
            brand_name: "EXAMPLEMED",
            dosage_form: "TABLET",
            route: "ORAL",
            active_ingredients: [{ strength: "10MG" }],
          },
        ],
      },
    ],
  };

  const matches = buildCandidateContexts("ExampleMed", ndcPayload, approvalsPayload);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].applicationNumbers[0], "NDA000001");
  assert.equal(matches[0].activeListingCount, 2);
  assert.deepEqual(matches[0].strengths, ["10 mg", "20 mg"]);
});

test("buildCandidateContexts keeps active ingredient aliases available for downstream shortage matching", () => {
  const ndcPayload = {
    results: [
      {
        application_number: "NDA000002",
        brand_name: "SignalMed",
        generic_name: "complex ingredient blend",
        labeler_name: "Beta Labs",
        dosage_form: "INJECTION",
        route: ["SUBCUTANEOUS"],
        active_ingredients: [{ name: "SEMAGLUTIDE", strength: "0.25 mg/0.5 mL" }],
        product_ndc: "22222-222",
        listing_expiration_date: "20991231",
        finished: true,
        product_type: "HUMAN PRESCRIPTION DRUG",
      },
    ],
  };

  const approvalsPayload = { results: [] };
  const matches = buildCandidateContexts("SignalMed", ndcPayload, approvalsPayload);

  assert.ok(matches[0].genericNames.includes("Semaglutide"));
});

test("buildDrugIntelligencePayload labels shortage-driven cases as higher friction", () => {
  const ndcPayload = {
    meta: { last_updated: "20260327" },
    results: [
      {
        application_number: "NDA000001",
        brand_name: "ExampleMed",
        generic_name: "example ingredient",
        labeler_name: "Alpha Labs",
        dosage_form: "TABLET",
        route: ["ORAL"],
        active_ingredients: [{ strength: "10 mg" }],
        product_ndc: "11111-111",
        listing_expiration_date: "20991231",
        finished: true,
        product_type: "HUMAN PRESCRIPTION DRUG",
      },
    ],
  };

  const approvalsPayload = {
    meta: { last_updated: "20260327" },
    results: [
      {
        application_number: "NDA000001",
        sponsor_name: "Alpha Labs",
        products: [
          {
            brand_name: "EXAMPLEMED",
            dosage_form: "TABLET",
            route: "ORAL",
            active_ingredients: [{ strength: "10MG" }],
          },
        ],
      },
    ],
  };

  const payload = buildDrugIntelligencePayload({
    query: "ExampleMed 10 mg",
    ndcPayload,
    approvalsPayload,
    shortageResultsById: {
      "nda000001-examplemed": {
        meta: { last_updated: "20260327" },
        results: [
          {
            status: "Currently in Shortage",
            presentation: "ExampleMed tablet 10 mg",
            update_date: "03/20/2026",
          },
        ],
      },
    },
    recallResultsById: {
      "nda000001-examplemed": {
        meta: { last_updated: "20260318" },
        results: [],
      },
    },
  });

  assert.equal(payload.matches[0].access_signal.level, "higher-friction");
  assert.equal(payload.featured_match_id, payload.matches[0].id);
});

test("pickFeaturedMatch keeps the highest query-relevance match first", () => {
  const featured = pickFeaturedMatch([
    {
      id: "brand-shell",
      active_listing_count: 6,
      evidence: { shortages: { active_count: 0 } },
    },
    {
      id: "shortage-backed",
      active_listing_count: 2,
      evidence: { shortages: { active_count: 3 } },
    },
  ]);

  assert.equal(featured.id, "brand-shell");
});
