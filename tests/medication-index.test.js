"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMedicationSnapshotFromOpenFdaRecords,
} = require("../lib/medications/normalize");
const {
  getMedicationSnapshot,
  searchMedicationOptions,
} = require("../lib/medications/index-store");

function buildSyntheticRecord({
  productNdc,
  brandName,
  genericName,
  dosageForm = "TABLET",
  route = ["ORAL"],
  activeIngredients,
  productType = "HUMAN PRESCRIPTION DRUG",
  marketingCategory = "ANDA",
  listingExpirationDate = "20991231",
  marketingStartDate = "20200101",
  marketingEndDate,
  labelerName = "Acme Labs",
  packaging = [],
}) {
  return {
    product_ndc: productNdc,
    brand_name: brandName,
    brand_name_base: brandName,
    generic_name: genericName,
    dosage_form: dosageForm,
    route,
    active_ingredients: activeIngredients,
    product_type: productType,
    marketing_category: marketingCategory,
    listing_expiration_date: listingExpirationDate,
    marketing_start_date: marketingStartDate,
    marketing_end_date: marketingEndDate,
    labeler_name: labelerName,
    finished: true,
    product_id: `${productNdc}_example`,
    packaging,
  };
}

test("medication snapshot dedupes package-level and near-duplicate product records", () => {
  const snapshot = buildMedicationSnapshotFromOpenFdaRecords(
    [
      buildSyntheticRecord({
        productNdc: "11111-111",
        brandName: "Example Med",
        genericName: "Example Ingredient",
        dosageForm: "TABLET, FILM COATED",
        activeIngredients: [{ name: "EXAMPLE INGREDIENT", strength: "10 mg/1" }],
        packaging: [
          { package_ndc: "11111-111-01" },
          { package_ndc: "11111-111-02" },
        ],
        labelerName: "Alpha Labs",
      }),
      buildSyntheticRecord({
        productNdc: "22222-222",
        brandName: "Example Med",
        genericName: "Example Ingredient",
        dosageForm: "TABLET, FILM COATED",
        activeIngredients: [{ name: "EXAMPLE INGREDIENT", strength: "10 mg/1" }],
        packaging: [{ package_ndc: "22222-222-01" }],
        labelerName: "Beta Labs",
      }),
      buildSyntheticRecord({
        productNdc: "33333-333",
        brandName: "ExpiredMed",
        genericName: "Old Ingredient",
        activeIngredients: [{ name: "OLD INGREDIENT", strength: "5 mg/1" }],
        listingExpirationDate: "20200101",
      }),
    ],
    {
      sourceLastUpdated: "2026-03-27",
      referenceDate: new Date("2026-03-29T00:00:00.000Z"),
    },
  );

  assert.equal(snapshot.counts.included, 2);
  assert.equal(snapshot.records.length, 1);
  assert.equal(snapshot.records[0].displayLabel, "Example Med 10 mg");
  assert.equal(snapshot.records[0].productCount, 2);
  assert.equal(snapshot.records[0].packageCount, 3);
  assert.equal(snapshot.records[0].labelerCount, 2);
});

test("medication snapshot preserves canonical aliases for brand, generic, ingredient, strength, and NDC", () => {
  const snapshot = buildMedicationSnapshotFromOpenFdaRecords(
    [
      buildSyntheticRecord({
        productNdc: "44444-444",
        brandName: "Adderall",
        genericName:
          "Dextroamphetamine Saccharate, Amphetamine Aspartate, Dextroamphetamine Sulfate, And Amphetamine Sulfate",
        dosageForm: "CAPSULE, EXTENDED RELEASE",
        activeIngredients: [
          { name: "DEXTROAMPHETAMINE SACCHARATE", strength: "5 mg/1" },
          { name: "AMPHETAMINE ASPARTATE", strength: "5 mg/1" },
          { name: "DEXTROAMPHETAMINE SULFATE", strength: "5 mg/1" },
          { name: "AMPHETAMINE SULFATE", strength: "5 mg/1" },
        ],
      }),
    ],
    {
      sourceLastUpdated: "2026-03-27",
      referenceDate: new Date("2026-03-29T00:00:00.000Z"),
    },
  );

  const record = snapshot.records[0];

  assert.equal(record.displayLabel, "Adderall 20 mg");
  assert.ok(record.aliases.includes("Adderall XR 20 mg"));
  assert.ok(record.aliases.includes("Adderall 20 mg"));
  assert.ok(record.aliases.includes("Amphetamine Aspartate"));
  assert.ok(record.aliases.includes("44444-444"));
  assert.equal(record.workflowCategory, "controlled_stimulant");
});

test("exact medication search returns the canonical display label used for selection", async () => {
  const snapshot = await getMedicationSnapshot();
  assert.ok(snapshot.records.length > 1000);

  const { results } = await searchMedicationOptions("Concerta 18 mg", {
    exact: true,
    limit: 1,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].label, "Concerta");
  assert.equal(results[0].matchedStrength, "18 mg");
  assert.ok(results[0].strengths.some((strength) => strength.value === "18 mg"));
  assert.ok(results[0].strengths.some((strength) => strength.value === "54 mg"));
});

test("medication search groups real catalog strengths under one selectable option", async () => {
  const { results } = await searchMedicationOptions("Adderall", {
    limit: 5,
  });

  const adderallEr = results.find((result) => result.label === "Adderall ER");
  const adderallIr = results.find((result) => result.label === "Adderall IR");

  assert.ok(adderallEr);
  assert.ok(adderallIr);
  assert.ok(adderallEr.strengths.length > 2);
  assert.ok(adderallIr.strengths.length > 2);
  assert.equal(adderallEr.source, "openfda");
});

test("demo medications stay searchable and isolated from the FDA-backed catalog", async () => {
  const { results } = await searchMedicationOptions("Vellocet ER 20 mg", {
    exact: true,
    limit: 1,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].label, "Vellocet ER");
  assert.equal(results[0].source, "demo");
  assert.equal(results[0].demoOnly, true);
  assert.equal(results[0].simulatedUserCount, 100);
  assert.equal(results[0].matchedStrength, "20 mg");
});
