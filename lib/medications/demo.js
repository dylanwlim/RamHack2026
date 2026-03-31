"use strict";

const { DEMO_MEDICATIONS } = require("../../data/demo-medications");
const { normalizeMedicationText } = require("./normalize");
const {
  buildMedicationQueryLabel,
  inferMatchedStrength,
  sortStrengthValues,
  toStrengthOption,
} = require("./selection");

function uniqueStrings(values) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function buildDescription(entry, strengths) {
  const strengthLabel =
    strengths.length === 1 ? "1 strength" : `${strengths.length} strengths`;
  return `Simulated demo medication • ${entry.route} ${entry.dosageForm} • ${strengthLabel}`;
}

function buildDemoMedicationOption(entry) {
  const strengths = sortStrengthValues(entry.supportedStrengths || []);
  const aliases = uniqueStrings([
    entry.label,
    entry.canonicalName,
    ...(entry.aliases || []),
    ...strengths.map((strength) => `${entry.label} ${strength}`),
    ...strengths.map((strength) => `${entry.canonicalName} ${strength}`),
  ]);

  return {
    id: entry.id,
    label: entry.label,
    value: entry.label,
    description: buildDescription(entry, strengths),
    badge: "Demo",
    source: "demo",
    canonicalName: entry.canonicalName,
    canonicalLabel: entry.label,
    queryBaseLabel: entry.label,
    queryDosageForm: null,
    formulation: entry.formulationLabel || null,
    formulationShortLabel: entry.formulationShortLabel || null,
    dosageForm: entry.dosageForm || null,
    route: entry.route || null,
    strengths: strengths.map(toStrengthOption),
    matchedStrength: null,
    workflowCategory: entry.workflowCategory,
    demoOnly: true,
    demoNote: entry.internalNote,
    simulatedUserCount: entry.simulatedUserCount,
    aliases,
    normalizedAliases: aliases.map(normalizeMedicationText),
    normalizedIdentifiers: [],
    searchText: normalizeMedicationText(
      [
        ...aliases,
        entry.variantType,
        entry.formulationLabel,
        entry.dosageForm,
        entry.route,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

const DEMO_OPTIONS = DEMO_MEDICATIONS.map(buildDemoMedicationOption);

function getDemoMedicationOptions() {
  return DEMO_OPTIONS;
}

function resolveDemoMedicationOption(query) {
  const normalizedQuery = normalizeMedicationText(query);

  if (!normalizedQuery) {
    return null;
  }

  const matchedOption =
    DEMO_OPTIONS.find((option) => option.normalizedAliases.includes(normalizedQuery)) || null;

  if (!matchedOption) {
    return null;
  }

  return {
    ...matchedOption,
    matchedStrength: inferMatchedStrength(query, matchedOption.strengths),
  };
}

function getDemoMedicationEntryById(id) {
  return DEMO_MEDICATIONS.find((entry) => entry.id === id) || null;
}

function resolveDemoMedicationEntry(query) {
  const option = resolveDemoMedicationOption(query);
  return option ? getDemoMedicationEntryById(option.id) : null;
}

function buildSignalAssessment(entry) {
  if (entry.id === "demo-vellocet-er") {
    return {
      level: "higher-friction",
      label: "Simulated higher-friction access signal",
      patientSummary: entry.patientSummary,
      prescriberSummary: entry.prescriberSummary,
      reasoning: [
        "This demo ER variant concentrates more pressure in the higher strengths.",
        "Manufacturer coverage is intentionally narrower than the IR variant.",
        "The crowd and medication surfaces stay labeled as simulated for demo safety.",
      ],
    };
  }

  if (entry.id === "demo-vellocet-ir") {
    return {
      level: "steadier",
      label: "Simulated steadier access signal",
      patientSummary: entry.patientSummary,
      prescriberSummary: entry.prescriberSummary,
      reasoning: [
        "The demo IR variant keeps broader simulated manufacturer coverage.",
        "Multiple strengths remain available so the workflow can show a cleaner refill path.",
        "This remains a simulated medication profile and not part of the main medication reference flow.",
      ],
    };
  }

  return {
    level: "mixed",
    label: "Simulated mixed access signal",
    patientSummary: entry.patientSummary,
    prescriberSummary: entry.prescriberSummary,
    reasoning: [
      "The parent demo entry is intentionally mixed so the UI can show multiple states without implying certainty.",
      "Higher strengths are modeled as tighter than lower strengths.",
      "This medication family is fictional and exists only for the demo flow.",
    ],
  };
}

function buildPatientQuestions(entry, selectedMedicationLabel) {
  return [
    `Do you have ${selectedMedicationLabel} available today in the exact prescribed formulation?`,
    "If not, which nearby store or later pickup window would you try next?",
    "Should the prescriber consider a different strength or release type before the patient keeps calling?",
  ];
}

function buildDemoDrugMatch(entry, query) {
  const option = resolveDemoMedicationOption(query) || buildDemoMedicationOption(entry);
  const selectedMedicationLabel =
    buildMedicationQueryLabel(option, option.matchedStrength) || option.label;
  const signal = buildSignalAssessment(entry);
  const activeShortages = entry.shortages.filter((item) => item.normalizedStatus === "active");
  const recentRecalls = entry.recalls || [];

  return {
    id: entry.id,
    display_name: entry.label,
    generic_name: entry.canonicalName,
    canonical_label: entry.label,
    brand_names: [entry.label],
    dosage_forms: [entry.dosageForm],
    routes: [entry.route],
    strengths: sortStrengthValues(entry.supportedStrengths || []),
    manufacturers: uniqueStrings(entry.shortages.map((item) => item.companyName)),
    sponsors: [],
    application_numbers: [],
    product_ndcs: [],
    marketing_categories: ["Demo"],
    active_listing_count: uniqueStrings(entry.shortages.map((item) => item.presentation)).length,
    inactive_listing_count: 0,
    package_count: uniqueStrings(entry.shortages.map((item) => item.presentation)).length,
    latest_listing_date: "2026-03-29",
    data_source: "demo",
    demo_context: {
      demo_only: true,
      source_label: "Simulated demo medication",
      note: entry.internalNote,
      simulated_user_count: entry.simulatedUserCount,
      selected_strength: option.matchedStrength || null,
      selected_label: selectedMedicationLabel,
    },
    access_signal: {
      level: signal.level,
      label: signal.label,
      confidence_label: "Simulated demo signal",
      reasoning: signal.reasoning,
      patient_summary: signal.patientSummary,
      prescriber_summary: signal.prescriberSummary,
    },
    patient_view: {
      headline: signal.label,
      summary: signal.patientSummary,
      what_we_know: [
        `${entry.simulatedUserCount} simulated demo users are associated with this fictional medication variant.`,
        `${entry.supportedStrengths.length} modeled strengths are available for the ${entry.label} option.`,
        "This record is intentionally isolated from the main medication catalog.",
      ],
      what_may_make_it_harder: signal.reasoning,
      questions_to_ask: buildPatientQuestions(entry, selectedMedicationLabel),
      unavailable: [
        "Live shelf inventory is still unavailable.",
        "This demo medication is fictional.",
      ],
    },
    prescriber_view: {
      headline: signal.label,
      summary: signal.prescriberSummary,
      takeaways: entry.takeaways,
      should_consider_alternatives: signal.level !== "steadier",
    },
    evidence: {
      shortages: {
        total: entry.shortages.length,
        active_count: activeShortages.length,
        items: entry.shortages,
      },
      recalls: {
        total: recentRecalls.length,
        recent_count: recentRecalls.length,
        items: recentRecalls,
      },
      approvals: {
        sponsor_name: null,
        latest_submission_date: null,
        latest_submission_label: "Simulated demo record",
        recent_manufacturing_updates: [],
        recent_labeling_updates: [],
      },
    },
  };
}

function buildDemoDrugIntelligencePayload(query) {
  const option = resolveDemoMedicationOption(query);
  if (!option) {
    return null;
  }

  const entry = getDemoMedicationEntryById(option.id);
  if (!entry) {
    return null;
  }

  const match = buildDemoDrugMatch(entry, query);

  return {
    status: "ok",
    generated_at: new Date().toISOString(),
    query: {
      raw: query.trim(),
      search_phrases: [query.trim()],
    },
    data_freshness: {
      ndc_last_updated: null,
      shortages_last_updated: "2026-03-29",
      approvals_last_updated: null,
      recalls_last_updated: entry.recalls.length ? "2026-02-14" : null,
    },
    featured_match_id: match.id,
    data_source: "demo",
    demo_context: match.demo_context,
    matches: [match],
    limitations: [
      "This medication family is fictional and exists only for the demo.",
      "The strengths, contributor counts, and shortage context are simulated.",
      "Real pharmacies still require direct confirmation because inventory is not live-verified.",
    ],
    methodology_summary:
      "This is a simulated demo medication profile kept separate from the main medication catalog so the demo can show search, strength, and crowd workflows without mislabeling fictional data as real.",
  };
}

module.exports = {
  buildDemoDrugIntelligencePayload,
  getDemoMedicationEntryById,
  getDemoMedicationOptions,
  resolveDemoMedicationEntry,
  resolveDemoMedicationOption,
};
