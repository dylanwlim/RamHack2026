"use strict";

const DEFAULT_RADIUS_MILES = 5;
const MAX_RADIUS_MILES = 25;
const MAX_RESULTS = 20;
const SEARCH_DISCLAIMER =
  "Showing nearby pharmacies for your medication search. Real-time inventory availability is not yet verified.";
const REAL_RESULTS_LABEL =
  "Pharmacy names, addresses, ratings, hours, and Maps links come from live Google Places results.";

const MEDICATION_PROFILES = {
  controlled_stimulant: {
    label: "Controlled medication workflow",
    workflow_label: "Higher-friction handoff",
    ranking_focus_label: "Open + trusted + nearby",
    ranking: {
      openWeight: 48,
      closedWeight: -22,
      unknownHoursWeight: -8,
      ratingWeight: 11,
      reviewWeight: 12,
      reviewCap: 30,
      distanceWeight: 4.8,
      missingDistancePenalty: 40,
    },
  },
  acute_antibiotic: {
    label: "Same-day treatment workflow",
    workflow_label: "Urgent same-day check",
    ranking_focus_label: "Closest open options first",
    ranking: {
      openWeight: 46,
      closedWeight: -26,
      unknownHoursWeight: -10,
      ratingWeight: 8,
      reviewWeight: 4.5,
      reviewCap: 10,
      distanceWeight: 14,
      missingDistancePenalty: 52,
    },
  },
  cold_chain: {
    label: "Cold-chain medication workflow",
    workflow_label: "Shipment-sensitive refill",
    ranking_focus_label: "Reputation + travel balance",
    ranking: {
      openWeight: 38,
      closedWeight: -18,
      unknownHoursWeight: -7,
      ratingWeight: 13,
      reviewWeight: 13.5,
      reviewCap: 36,
      distanceWeight: 3.6,
      missingDistancePenalty: 38,
    },
  },
  maintenance_refill: {
    label: "Routine refill workflow",
    workflow_label: "Routine refill coordination",
    ranking_focus_label: "Balanced nearby match",
    ranking: {
      openWeight: 36,
      closedWeight: -18,
      unknownHoursWeight: -6,
      ratingWeight: 12,
      reviewWeight: 10,
      reviewCap: 28,
      distanceWeight: 5.5,
      missingDistancePenalty: 40,
    },
  },
};

const MEDICATION_MATCHERS = [
  {
    key: "controlled_stimulant",
    patterns: [
      /\badderall\b/i,
      /\bamphetamine\b/i,
      /\bvyvanse\b/i,
      /\blisdexamfetamine\b/i,
      /\bconcerta\b/i,
      /\britalin\b/i,
      /\bmethylphenidate\b/i,
      /\bfocalin\b/i,
      /\bdexmethylphenidate\b/i,
    ],
  },
  {
    key: "acute_antibiotic",
    patterns: [
      /\bamoxicillin\b/i,
      /\baugmentin\b/i,
      /\bazithromycin\b/i,
      /\bcephalexin\b/i,
      /\bdoxycycline\b/i,
      /\bclindamycin\b/i,
      /\bciprofloxacin\b/i,
      /\bcefdinir\b/i,
      /\bpenicillin\b/i,
    ],
  },
  {
    key: "cold_chain",
    patterns: [
      /\bozempic\b/i,
      /\bwegovy\b/i,
      /\bmounjaro\b/i,
      /\bzepbound\b/i,
      /\btrulicity\b/i,
      /\bsaxenda\b/i,
      /\bvictoza\b/i,
      /\bsemaglutide\b/i,
      /\btirzepatide\b/i,
      /\binsulin\b/i,
    ],
  },
];

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") {
    return {};
  }

  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      const parseError = new Error("Request body must be valid JSON.");
      parseError.statusCode = 400;
      parseError.code = "invalid_json";
      throw parseError;
    }
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    const parseError = new Error("Request body must be valid JSON.");
    parseError.statusCode = 400;
    parseError.code = "invalid_json";
    throw parseError;
  }
}

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMedicationText(value) {
  return sanitizeText(value).toLowerCase();
}

function medicationIncludesStrength(value) {
  return /\d+(?:\.\d+)?\s*(mg|mcg|g|ml|iu|units?|%)/i.test(sanitizeText(value));
}

function withStrengthQualifier(medication) {
  return medicationIncludesStrength(medication)
    ? medication
    : `${medication} in the exact prescribed strength`;
}

function withDoseQualifier(medication) {
  return medicationIncludesStrength(medication)
    ? medication
    : `the prescribed ${medication} dose`;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
  }

  return false;
}

function normalizeRadiusMiles(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_RADIUS_MILES;
  }

  return Math.min(Math.max(numericValue, 1), MAX_RADIUS_MILES);
}

function normalizeSortBy(value) {
  const normalized = sanitizeText(value).toLowerCase().replaceAll("-", "_");

  if (normalized === "distance" || normalized === "rating") {
    return normalized;
  }

  return "best_match";
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineMiles(origin, destination) {
  const earthRadiusMiles = 3958.8;
  const latDelta = toRadians(destination.lat - origin.lat);
  const lngDelta = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);

  const haversineValue =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(lngDelta / 2) ** 2;

  return (
    2 *
    earthRadiusMiles *
    Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
  );
}

function formatReviewLabel(reviewCount) {
  if (!Number.isFinite(reviewCount) || reviewCount <= 0) {
    return "No review count";
  }

  return `${reviewCount} Google review${reviewCount === 1 ? "" : "s"}`;
}

function buildGoogleMapsUrl(place) {
  if (place.place_id) {
    const query = encodeURIComponent(`${place.name} ${place.vicinity || ""}`.trim());
    const placeId = encodeURIComponent(place.place_id);
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`;
  }

  if (!place.geometry?.location) {
    return null;
  }

  const { lat, lng } = place.geometry.location;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function normalizePlace(place, center) {
  const coordinates = place.geometry?.location;
  const distanceMiles =
    coordinates && Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng)
      ? haversineMiles(center, coordinates)
      : null;

  return {
    name: place.name || "Unknown pharmacy",
    address: place.vicinity || place.formatted_address || "Address unavailable",
    rating: Number.isFinite(place.rating) ? place.rating : null,
    user_ratings_total: Number.isFinite(place.user_ratings_total)
      ? place.user_ratings_total
      : null,
    open_now:
      typeof place.opening_hours?.open_now === "boolean" ? place.opening_hours.open_now : null,
    place_id: place.place_id || null,
    google_maps_url: buildGoogleMapsUrl(place),
    coordinates:
      coordinates && Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng)
        ? { lat: coordinates.lat, lng: coordinates.lng }
        : null,
    distance_miles: distanceMiles,
    business_status: place.business_status || null,
    review_label: formatReviewLabel(place.user_ratings_total),
  };
}

function resolveMedicationProfile(medication, preferredProfileKey) {
  const normalizedMedication = normalizeMedicationText(medication);
  const preferredProfile = sanitizeText(preferredProfileKey).toLowerCase();

  if (preferredProfile && MEDICATION_PROFILES[preferredProfile]) {
    return {
      key: preferredProfile,
      normalizedMedication,
      ...MEDICATION_PROFILES[preferredProfile],
    };
  }

  const matchedProfile =
    MEDICATION_MATCHERS.find(({ patterns }) =>
      patterns.some((pattern) => pattern.test(normalizedMedication)),
    )?.key || "maintenance_refill";

  return {
    key: matchedProfile,
    normalizedMedication,
    ...MEDICATION_PROFILES[matchedProfile],
  };
}

function getDistanceBand(distanceMiles) {
  if (!Number.isFinite(distanceMiles)) {
    return "unknown";
  }

  if (distanceMiles <= 1) {
    return "very_close";
  }

  if (distanceMiles <= 2.5) {
    return "nearby";
  }

  return "backup";
}

function getBestMatchScore(place, medicationProfile) {
  const ranking = medicationProfile.ranking;
  const openBoost =
    place.open_now === true
      ? ranking.openWeight
      : place.open_now === false
        ? ranking.closedWeight
        : ranking.unknownHoursWeight;
  const ratingBoost = Number.isFinite(place.rating) ? place.rating * ranking.ratingWeight : 0;
  const reviewBoost = Number.isFinite(place.user_ratings_total)
    ? Math.min(
        Math.log10(place.user_ratings_total + 1) * ranking.reviewWeight,
        ranking.reviewCap,
      )
    : 0;
  const distancePenalty = Number.isFinite(place.distance_miles)
    ? place.distance_miles * ranking.distanceWeight
    : ranking.missingDistancePenalty;

  return openBoost + ratingBoost + reviewBoost - distancePenalty;
}

function sortResults(results, sortBy, medicationProfile) {
  const sorted = [...results];

  sorted.sort((left, right) => {
    if (sortBy === "distance") {
      return (
        (left.distance_miles ?? Number.POSITIVE_INFINITY) -
          (right.distance_miles ?? Number.POSITIVE_INFINITY) ||
        (right.rating ?? 0) - (left.rating ?? 0) ||
        (right.user_ratings_total ?? 0) - (left.user_ratings_total ?? 0)
      );
    }

    if (sortBy === "rating") {
      return (
        (right.rating ?? 0) - (left.rating ?? 0) ||
        (right.user_ratings_total ?? 0) - (left.user_ratings_total ?? 0) ||
        (left.distance_miles ?? Number.POSITIVE_INFINITY) -
          (right.distance_miles ?? Number.POSITIVE_INFINITY)
      );
    }

    return (
      getBestMatchScore(right, medicationProfile) - getBestMatchScore(left, medicationProfile) ||
      (left.distance_miles ?? Number.POSITIVE_INFINITY) -
        (right.distance_miles ?? Number.POSITIVE_INFINITY)
    );
  });

  return sorted;
}

function buildMedicationGuidance(medicationProfile, medication) {
  if (medicationProfile.key === "controlled_stimulant") {
    return {
      title: "Controlled-medication availability guidance",
      summary: `${medication} usually needs a higher-friction pharmacy handoff, so the first recommendation favors open pharmacies with stronger review history and reasonable travel time.`,
      ranking_focus:
        "Best overall match weighs open status, review depth, and distance so the first controlled-medication call is more likely to be worth the effort.",
      ranking_focus_label: medicationProfile.ranking_focus_label,
      recommended_action: `Ask whether ${withStrengthQualifier(medication)} can be filled today before routing or transferring the prescription.`,
      questions_to_ask: [
        `Can you fill ${withStrengthQualifier(medication)} today?`,
        "Should the prescription be sent directly to this location, or is another store in your network better positioned?",
        "If not today, when should I call back or what nearby store would you try next?",
      ],
      tags: ["Controlled medication", "Direct-send first", "Stock not live-verified"],
      real_signal: REAL_RESULTS_LABEL,
      demo_boundary:
        "Medication guidance is workflow support only. PharmaPath is not verifying controlled-substance stock in real time.",
    };
  }

  if (medicationProfile.key === "acute_antibiotic") {
    return {
      title: "Same-day medication guidance",
      summary: `${medication} is treated like a same-day medication search, so the ranking leans harder toward the closest open pharmacies for a faster pickup path.`,
      ranking_focus:
        "Best overall match emphasizes proximity and open-now status more heavily than rating to support a faster same-day call sequence.",
      ranking_focus_label: medicationProfile.ranking_focus_label,
      recommended_action: `Ask how quickly ${medication} can be prepared and what the pickup window looks like today.`,
      questions_to_ask: [
        `Can you fill ${medication} today, and how soon would it be ready for pickup?`,
        "If this store is out, which nearby location would you try next right away?",
        "Is there anything about insurance or quantity that could delay a same-day pickup?",
      ],
      tags: ["Same-day medication", "Closest open options", "Stock not live-verified"],
      real_signal: REAL_RESULTS_LABEL,
      demo_boundary:
        "Medication guidance reflects a same-day outreach strategy only. PharmaPath is not confirming antibiotic inventory live.",
    };
  }

  if (medicationProfile.key === "cold_chain") {
    return {
      title: "Shipment-sensitive refill guidance",
      summary: `${medication} often depends on dose timing and shipment cadence, so the shortlist leans toward better-rated pharmacies that are still practical to call quickly.`,
      ranking_focus:
        "Best overall match balances reputation, review volume, current hours, and travel distance for medications that often require shipment or refrigerator-handling questions.",
      ranking_focus_label: medicationProfile.ranking_focus_label,
      recommended_action: `Ask about the exact strength, refrigeration handling, and when the next shipment of ${medication} is expected.`,
      questions_to_ask: [
        `Do you have ${withDoseQualifier(medication)} or know when the next shipment arrives?`,
        "If you do not have it now, how do you handle waitlists, transfers, or next-delivery timing?",
        "Are there any storage or pickup timing details the patient should know before coming in?",
      ],
      tags: ["Shipment-sensitive", "Dose-specific call", "Stock not live-verified"],
      real_signal: REAL_RESULTS_LABEL,
      demo_boundary:
        "Medication guidance helps frame the refill conversation. PharmaPath is not reading live refrigerated-inventory feeds.",
    };
  }

  return {
    title: "Routine refill guidance",
    summary: `${medication} is treated as a routine refill workflow, so the ranking balances nearby access, pharmacy reputation, and current hours for the first outreach.`,
    ranking_focus:
      "Best overall match balances proximity, review quality, and open-now signals to make the first refill call easier to explain.",
    ranking_focus_label: medicationProfile.ranking_focus_label,
    recommended_action: `Ask about refill turnaround, transfer timing, and insurance processing for ${medication}.`,
    questions_to_ask: [
      `Can you fill or transfer ${medication} without delaying the patient?`,
      "If it is not ready today, what turnaround time should the patient expect?",
      "Are there any refill or insurance steps that should be handled before the prescription is sent here?",
    ],
    tags: ["Routine refill", "Balanced shortlist", "Stock not live-verified"],
    real_signal: REAL_RESULTS_LABEL,
    demo_boundary:
      "Medication guidance supports the call workflow only. PharmaPath is not verifying routine-medication stock in real time.",
  };
}

function buildPlaceWorkflow(place, medicationProfile, medication) {
  const distanceBand = getDistanceBand(place.distance_miles);

  if (medicationProfile.key === "controlled_stimulant") {
    const matchReason =
      Number.isFinite(place.user_ratings_total) && place.user_ratings_total >= 100
        ? "Stronger reputation signal for a higher-friction controlled-medication handoff."
        : distanceBand === "very_close"
          ? "Very close option for a same-day controlled-medication check."
          : "Useful backup if the first pharmacy cannot take the prescription.";

    return {
      workflow_label: medicationProfile.workflow_label,
      match_reason: matchReason,
      next_step: `Ask whether ${withStrengthQualifier(medication)} can be filled today before sending the prescription here.`,
      inventory_note: `${place.name} is a real Google Places result, but ${medication} stock is not live-verified in PharmaPath.`,
    };
  }

  if (medicationProfile.key === "acute_antibiotic") {
    const matchReason =
      distanceBand === "very_close"
        ? "Closest same-day option if pickup speed matters."
        : distanceBand === "nearby"
          ? "Still close enough to try early in the same-day call sequence."
          : "Keep this as a backup if the closest pharmacies cannot fill quickly.";

    return {
      workflow_label: medicationProfile.workflow_label,
      match_reason: matchReason,
      next_step: `Ask how quickly ${medication} can be ready for pickup today and whether a transfer would slow things down.`,
      inventory_note: `${place.name} is a real pharmacy lookup from Google, but PharmaPath is not confirming ${medication} inventory live.`,
    };
  }

  if (medicationProfile.key === "cold_chain") {
    const matchReason =
      Number.isFinite(place.rating) && place.rating >= 4.7
        ? "Higher-rated option for a medication that often depends on dose timing and shipment cadence."
        : "Reasonable backup for confirming dose-specific availability and shipment timing.";

    return {
      workflow_label: medicationProfile.workflow_label,
      match_reason: matchReason,
      next_step: `Ask about ${withDoseQualifier(medication)}, refrigeration handling, and when the next shipment is expected.`,
      inventory_note: `${place.name} is a real Google Places result, but PharmaPath does not have live cold-chain inventory data.`,
    };
  }

  return {
    workflow_label: medicationProfile.workflow_label,
    match_reason:
      distanceBand === "very_close"
        ? "Convenient nearby option for a routine refill handoff."
        : "Balanced backup based on travel time and pharmacy reputation.",
    next_step: `Ask about refill timing, prescription transfer steps, and any insurance processing issues for ${medication}.`,
    inventory_note: `${place.name} is a real Google Places result, but ${medication} stock still needs direct confirmation.`,
  };
}

function createGoogleApiError(message, statusCode = 502, code = "google_api_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createGoogleApiError(`Google API request failed with HTTP ${response.status}.`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw createGoogleApiError("Google API request timed out.", 504, "google_api_timeout");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeLocation(location, apiKey) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", location);
  url.searchParams.set("key", apiKey);

  const payload = await fetchJson(url);

  if (payload.status === "ZERO_RESULTS") {
    throw createGoogleApiError("No location match was found for that search.", 404, "location_not_found");
  }

  if (payload.status !== "OK" || !Array.isArray(payload.results) || !payload.results.length) {
    throw createGoogleApiError(
      payload.error_message || `Geocoding failed with status ${payload.status || "UNKNOWN"}.`,
      502,
      "geocoding_failed",
    );
  }

  const match = payload.results[0];

  return {
    formatted_address: match.formatted_address,
    place_id: match.place_id || null,
    coordinates: {
      lat: match.geometry.location.lat,
      lng: match.geometry.location.lng,
    },
  };
}

async function searchNearbyPharmacies({
  medication,
  medicationProfileKey,
  center,
  radiusMiles,
  onlyOpenNow,
  apiKey,
  sortBy,
}) {
  const medicationProfile = resolveMedicationProfile(medication, medicationProfileKey);
  const radiusMeters = Math.max(1600, Math.round(radiusMiles * 1609.34));
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");

  url.searchParams.set("location", `${center.lat},${center.lng}`);
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("type", "pharmacy");
  url.searchParams.set("keyword", "pharmacy");
  url.searchParams.set("key", apiKey);

  if (onlyOpenNow) {
    url.searchParams.set("opennow", "true");
  }

  const payload = await fetchJson(url);

  if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
    throw createGoogleApiError(
      payload.error_message || `Places search failed with status ${payload.status || "UNKNOWN"}.`,
      502,
      "places_search_failed",
    );
  }

  const normalizedResults = Array.isArray(payload.results)
    ? payload.results
        .map((place) => normalizePlace(place, center))
        .filter((place) => place.distance_miles === null || place.distance_miles <= radiusMiles)
    : [];

  const sortedResults = sortResults(normalizedResults, sortBy, medicationProfile)
    .slice(0, MAX_RESULTS)
    .map((place) => ({
      ...place,
      ...buildPlaceWorkflow(place, medicationProfile, medication),
    }));
  const guidance = buildMedicationGuidance(medicationProfile, medication);

  return {
    disclaimer: SEARCH_DISCLAIMER,
    medication_context: medication,
    medication_profile: {
      key: medicationProfile.key,
      label: medicationProfile.label,
      workflow_label: medicationProfile.workflow_label,
    },
    guidance,
    results: sortedResults,
    recommended: sortedResults[0] || null,
    counts: {
      total: sortedResults.length,
      open_now: sortedResults.filter((item) => item.open_now === true).length,
      hours_unknown: sortedResults.filter((item) => item.open_now === null).length,
    },
  };
}

function getSearchInput(req, body = {}) {
  const source = req.method === "GET" ? req.query || {} : body;

  return {
    medication: sanitizeText(source.medication || source.query),
    location: sanitizeText(source.location),
    radiusMiles: normalizeRadiusMiles(source.radiusMiles || source.radius_miles),
    onlyOpenNow: normalizeBoolean(source.onlyOpenNow || source.only_open_now),
    sortBy: normalizeSortBy(source.sortBy || source.sort_by),
  };
}

module.exports = {
  SEARCH_DISCLAIMER,
  geocodeLocation,
  getSearchInput,
  readJsonBody,
  searchNearbyPharmacies,
  sendJson,
};
