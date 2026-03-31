"use strict";

const { resolveDemoMedicationOption } = require("../medications/demo");

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseFiniteNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildMedicationProfileFromSubmittedSearch(input, metadata = {}) {
  const medication = sanitizeText(input.medication);
  const workflowCategory = sanitizeText(metadata.medicationWorkflowCategory);
  const medicationSource = sanitizeText(metadata.medicationSource).toLowerCase();

  if (!medication) {
    return null;
  }

  if (medicationSource === "demo") {
    const demoOption = resolveDemoMedicationOption(medication);

    if (demoOption) {
      return {
        canonicalLabel: medication,
        workflowCategory: demoOption.workflowCategory,
        source: demoOption.source,
        demoOnly: Boolean(demoOption.demoOnly),
        demoNote: demoOption.demoNote || null,
        simulatedUserCount: demoOption.simulatedUserCount || null,
        medicationLabel: demoOption.label,
        selectedStrength:
          sanitizeText(metadata.medicationSelectedStrength) || demoOption.matchedStrength || null,
        dosageForm: demoOption.dosageForm || null,
        formulation: demoOption.formulation || null,
      };
    }
  }

  if (!workflowCategory) {
    return null;
  }

  return {
    canonicalLabel: medication,
    workflowCategory,
    source: "openfda",
    demoOnly: false,
    demoNote: null,
    simulatedUserCount: null,
    medicationLabel: sanitizeText(metadata.medicationLabel) || medication,
    selectedStrength: sanitizeText(metadata.medicationSelectedStrength) || null,
    dosageForm: sanitizeText(metadata.medicationDosageForm) || null,
    formulation: sanitizeText(metadata.medicationFormulation) || null,
  };
}

function buildResolvedLocationFromSubmittedSearch(input, metadata = {}) {
  const lat = parseFiniteNumber(metadata.locationLat);
  const lng = parseFiniteNumber(metadata.locationLng);

  if (lat === null || lng === null) {
    return null;
  }

  const displayLabel = sanitizeText(input.location);
  const placeId = sanitizeText(input.locationPlaceId) || null;

  return {
    raw_query: displayLabel,
    display_label: displayLabel,
    formatted_address: displayLabel,
    name: null,
    place_id: placeId,
    coordinates: { lat, lng },
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
  };
}

module.exports = {
  buildMedicationProfileFromSubmittedSearch,
  buildResolvedLocationFromSubmittedSearch,
};
