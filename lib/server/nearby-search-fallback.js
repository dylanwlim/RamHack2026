"use strict";

const {
  buildMedicationGuidance,
  resolveMedicationProfile: resolveSearchMedicationProfile,
} = require("./pharmacy-search");

function buildUnavailableLocation(input) {
  return {
    raw_query: input.location,
    display_label: input.location,
    formatted_address: input.location,
    name: null,
    place_id: input.locationPlaceId || null,
    coordinates: {
      lat: 0,
      lng: 0,
    },
    types: [],
    resolution_source: "unresolved_input",
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

function buildUnavailableNearbyResponse(input, medicationProfile, reason, reasonCode = null) {
  const searchMedicationProfile = resolveSearchMedicationProfile(
    medicationProfile.canonicalLabel,
    medicationProfile.workflowCategory,
  );

  return {
    status: "degraded",
    degraded_reason: reason,
    degraded_code: reasonCode,
    query: {
      medication: medicationProfile.canonicalLabel,
      location: input.location,
      location_place_id: input.locationPlaceId || null,
      radius_miles: input.radiusMiles,
      only_open_now: input.onlyOpenNow,
      sort_by: input.sortBy,
    },
    location: buildUnavailableLocation(input),
    disclaimer:
      "Live nearby pharmacy search is unavailable right now. Medication context remains available below, but this page is not showing live pharmacy results.",
    medication_profile: {
      key: searchMedicationProfile.key,
      label: searchMedicationProfile.label,
      workflow_label: searchMedicationProfile.workflow_label,
      source: medicationProfile.source,
      demo_only: medicationProfile.demoOnly,
      demo_note: medicationProfile.demoNote,
      simulated_user_count: medicationProfile.simulatedUserCount,
      medication_label: medicationProfile.medicationLabel,
      selected_strength: medicationProfile.selectedStrength,
      dosage_form: medicationProfile.dosageForm,
      formulation: medicationProfile.formulation,
    },
    guidance: {
      ...buildMedicationGuidance(searchMedicationProfile, medicationProfile.canonicalLabel),
      real_signal:
        "Live nearby pharmacy search is unavailable in this environment, so pharmacy names and addresses are not being returned.",
      demo_boundary:
        "Medication guidance remains available even when live nearby search is unavailable. PharmaPath is not verifying stock in real time.",
    },
    results: [],
    recommended: null,
    counts: {
      total: 0,
      open_now: 0,
      hours_unknown: 0,
    },
  };
}

function shouldDegradeNearbySearch(error) {
  if (!error) {
    return false;
  }

  if (error.statusCode && error.statusCode < 500) {
    return false;
  }

  return [
    "google_api_error",
    "google_api_timeout",
    "places_search_failed",
    "place_details_failed",
    "places_autocomplete_failed",
    "geocoding_failed",
  ].includes(error.code);
}

module.exports = {
  buildUnavailableNearbyResponse,
  shouldDegradeNearbySearch,
};
