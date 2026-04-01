"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildLooseTokenFieldQuery,
  buildShortageSearchQuery,
  collectShortageIngredientTokens,
} = require("../lib/server/openfda-shortages");

test("collectShortageIngredientTokens keeps meaningful ingredients and drops generic salt words", () => {
  const tokens = collectShortageIngredientTokens([
    "Amphetamine Aspartate Monohydrate, Amphetamine Sulfate, Dextroamphetamine Saccharate, Dextroamphetamine Sulfate",
    "Semaglutide Injection",
  ]);

  assert.deepEqual(tokens, ["amphetamine", "dextroamphetamine", "semaglutide"]);
});

test("buildLooseTokenFieldQuery emits OR clauses for usable tokens only", () => {
  assert.equal(
    buildLooseTokenFieldQuery("generic_name", ["semaglutide", "Na", "dextroamphetamine"]),
    "(generic_name:semaglutide+OR+generic_name:dextroamphetamine)",
  );
});

test("buildShortageSearchQuery combines exact brand phrases with loose ingredient terms", () => {
  const query = buildShortageSearchQuery({
    brandNames: ["Adderall"],
    genericNames: [
      "Amphetamine Aspartate Monohydrate, Dextroamphetamine Sulfate",
      "Mixed amphetamine salts",
    ],
  });

  assert.equal(
    query,
    '((proprietary_name:"Adderall"+OR+generic_name:"Amphetamine Aspartate Monohydrate, Dextroamphetamine Sulfate"+OR+generic_name:"Mixed amphetamine salts")+OR+(generic_name:amphetamine+OR+generic_name:dextroamphetamine+OR+generic_name:mixed))',
  );
});

test("buildShortageSearchQuery returns an empty string when no search terms survive cleanup", () => {
  const query = buildShortageSearchQuery({
    brandNames: [""],
    genericNames: ["and", "Na"],
  });

  assert.equal(query, "");
});
