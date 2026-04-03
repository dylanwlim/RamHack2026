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

function isLikelyUsPostalCode(value) {
  return /^\d{5}(?:-\d{4})?$/.test(sanitizeText(value));
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

function getAddressComponent(components, type) {
  return (
    (Array.isArray(components)
      ? components.find(
          (component) => Array.isArray(component.types) && component.types.includes(type),
        )
      : null) || null
  );
}

function getFirstAddressComponent(components, types) {
  for (const type of types) {
    const component = getAddressComponent(components, type);
    if (component) {
      return component;
    }
  }

  return null;
}

function extractStructuredLocationFields(components) {
  const cityComponent = getFirstAddressComponent(components, [
    "locality",
    "postal_town",
    "sublocality",
    "sublocality_level_1",
    "administrative_area_level_3",
    "administrative_area_level_2",
  ]);
  const neighborhoodComponent = getFirstAddressComponent(components, [
    "neighborhood",
    "sublocality",
    "sublocality_level_1",
  ]);
  const stateComponent = getAddressComponent(components, "administrative_area_level_1");
  const postalCodeComponent = getAddressComponent(components, "postal_code");
  const countryComponent = getAddressComponent(components, "country");
  const routeComponent = getAddressComponent(components, "route");
  const streetNumberComponent = getAddressComponent(components, "street_number");

  return {
    city: cityComponent?.long_name || null,
    state: stateComponent?.short_name || stateComponent?.long_name || null,
    postal_code: postalCodeComponent?.long_name || null,
    neighborhood: neighborhoodComponent?.long_name || null,
    country: countryComponent?.long_name || null,
    country_code: countryComponent?.short_name || null,
    route: routeComponent?.long_name || null,
    street_number: streetNumberComponent?.long_name || null,
  };
}

function buildResolvedLocation({
  rawQuery,
  displayLabel,
  formattedAddress,
  name,
  placeId,
  coordinates,
  components,
  types,
  resolutionSource,
}) {
  if (!coordinates || !Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)) {
    throw createGoogleApiError("Resolved location is missing coordinates.", 502, "location_missing_coordinates");
  }

  return {
    raw_query: sanitizeText(rawQuery),
    display_label:
      sanitizeText(displayLabel) || sanitizeText(formattedAddress) || sanitizeText(name) || sanitizeText(rawQuery),
    formatted_address:
      sanitizeText(formattedAddress) || sanitizeText(displayLabel) || sanitizeText(name) || sanitizeText(rawQuery),
    name: sanitizeText(name) || null,
    place_id: sanitizeText(placeId) || null,
    coordinates: {
      lat: coordinates.lat,
      lng: coordinates.lng,
    },
    types: Array.isArray(types) ? types.filter((type) => typeof type === "string") : [],
    resolution_source: resolutionSource,
    ...extractStructuredLocationFields(components),
  };
}

function getLocationSuggestionTypeLabel(types) {
  if (!Array.isArray(types) || !types.length) {
    return "Location";
  }

  if (types.includes("postal_code")) {
    return "ZIP";
  }

  if (
    types.some((type) =>
      [
        "street_address",
        "premise",
        "subpremise",
        "route",
        "intersection",
      ].includes(type),
    )
  ) {
    return "Address";
  }

  if (
    types.some((type) =>
      [
        "locality",
        "administrative_area_level_1",
        "administrative_area_level_2",
        "administrative_area_level_3",
        "sublocality",
        "sublocality_level_1",
        "neighborhood",
      ].includes(type),
    )
  ) {
    return "Area";
  }

  if (types.some((type) => ["establishment", "point_of_interest", "pharmacy"].includes(type))) {
    return "Place";
  }

  return "Location";
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

function buildPhoneLink(phoneNumber) {
  const normalizedPhoneNumber = sanitizeText(phoneNumber);

  if (!normalizedPhoneNumber) {
    return null;
  }

  const dialableNumber = normalizedPhoneNumber
    .replace(/[^+\d]/g, "")
    .replace(/(?!^)\+/g, "");

  return dialableNumber ? `tel:${dialableNumber}` : null;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function parseGoogleTimeValue(timeValue) {
  const normalizedValue = sanitizeText(timeValue);

  if (!normalizedValue || !/^\d{3,4}$/.test(normalizedValue)) {
    return null;
  }

  const paddedValue = normalizedValue.padStart(4, "0");
  const hours = Number(paddedValue.slice(0, 2));
  const minutes = Number(paddedValue.slice(2, 4));

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  return { hours, minutes, totalMinutes: hours * 60 + minutes, raw: paddedValue };
}

function formatGoogleTimeLabel(timeValue) {
  const parsedTime = parseGoogleTimeValue(timeValue);

  if (!parsedTime) {
    return null;
  }

  const suffix = parsedTime.hours >= 12 ? "PM" : "AM";
  const normalizedHours = parsedTime.hours % 12 || 12;

  if (parsedTime.minutes === 0) {
    return `${normalizedHours} ${suffix}`;
  }

  return `${normalizedHours}:${String(parsedTime.minutes).padStart(2, "0")} ${suffix}`;
}

function getPlaceLocalDate(utcOffsetMinutes) {
  if (!Number.isFinite(utcOffsetMinutes)) {
    return null;
  }

  const nowUtcMs = Date.now();
  return new Date(nowUtcMs + utcOffsetMinutes * 60_000);
}

function normalizeWeekdayText(weekdayText) {
  if (!Array.isArray(weekdayText)) {
    return [];
  }

  return weekdayText
    .map((entry) => sanitizeText(entry))
    .filter(Boolean)
    .map((entry) => entry.replace(/\s*[–-]\s*/g, " – "));
}

function stripWeekdayLabel(weekdayText) {
  const normalizedText = sanitizeText(weekdayText);

  if (!normalizedText) {
    return null;
  }

  const separatorIndex = normalizedText.indexOf(":");
  return separatorIndex >= 0 ? normalizedText.slice(separatorIndex + 1).trim() : normalizedText;
}

function getTodayHoursLabel(weekdayText, localDayIndex) {
  if (!Number.isInteger(localDayIndex)) {
    return null;
  }

  const normalizedWeekdayText = normalizeWeekdayText(weekdayText);

  if (!normalizedWeekdayText.length) {
    return null;
  }

  const weekdayName = WEEKDAY_NAMES[localDayIndex];
  const todayLine = normalizedWeekdayText.find((entry) => entry.startsWith(`${weekdayName}:`));

  return stripWeekdayLabel(todayLine);
}

function buildHoursPeriodWindow(period) {
  const openDay = Number.isInteger(period?.open?.day) ? period.open.day : null;
  const closeDay = Number.isInteger(period?.close?.day) ? period.close.day : null;
  const openTime = parseGoogleTimeValue(period?.open?.time);
  const closeTime = parseGoogleTimeValue(period?.close?.time);

  if (
    openDay === null ||
    closeDay === null ||
    !openTime ||
    !closeTime ||
    openDay < 0 ||
    openDay > 6 ||
    closeDay < 0 ||
    closeDay > 6
  ) {
    return null;
  }

  const weekMinutes = 7 * 24 * 60;
  const startMinutes = openDay * 24 * 60 + openTime.totalMinutes;
  let endMinutes = closeDay * 24 * 60 + closeTime.totalMinutes;

  if (endMinutes <= startMinutes) {
    endMinutes += weekMinutes;
  }

  return {
    openDay,
    startMinutes,
    endMinutes,
    openTime: openTime.raw,
    closeTime: closeTime.raw,
  };
}

function resolveHoursPeriodDetails(periods, localDayIndex, localTimeMinutes) {
  if (!Number.isInteger(localDayIndex) || !Number.isInteger(localTimeMinutes) || !Array.isArray(periods)) {
    return null;
  }

  const weekMinutes = 7 * 24 * 60;
  const currentMinutes = localDayIndex * 24 * 60 + localTimeMinutes;
  const windows = periods.map(buildHoursPeriodWindow).filter(Boolean);

  if (!windows.length) {
    return null;
  }

  let activeWindow = null;
  let nextWindow = null;

  for (const window of windows) {
    if (
      (currentMinutes >= window.startMinutes && currentMinutes < window.endMinutes) ||
      (currentMinutes + weekMinutes >= window.startMinutes &&
        currentMinutes + weekMinutes < window.endMinutes)
    ) {
      activeWindow = window;
    }

    const nextStartMinutes =
      window.startMinutes > currentMinutes ? window.startMinutes : window.startMinutes + weekMinutes;

    if (!nextWindow || nextStartMinutes < nextWindow.absoluteStartMinutes) {
      nextWindow = {
        ...window,
        absoluteStartMinutes: nextStartMinutes,
      };
    }
  }

  if (activeWindow) {
    return {
      closingTimeLabel: formatGoogleTimeLabel(activeWindow.closeTime),
      nextOpenLabel: null,
    };
  }

  if (!nextWindow) {
    return null;
  }

  const dayOffset =
    Math.floor(nextWindow.absoluteStartMinutes / (24 * 60)) -
    Math.floor(currentMinutes / (24 * 60));
  const openingTimeLabel = formatGoogleTimeLabel(nextWindow.openTime);

  if (!openingTimeLabel) {
    return null;
  }

  if (dayOffset <= 0) {
    return {
      closingTimeLabel: null,
      nextOpenLabel: openingTimeLabel,
    };
  }

  if (dayOffset === 1) {
    return {
      closingTimeLabel: null,
      nextOpenLabel: `tomorrow ${openingTimeLabel}`,
    };
  }

  return {
    closingTimeLabel: null,
    nextOpenLabel: `${WEEKDAY_NAMES[nextWindow.openDay]} ${openingTimeLabel}`,
  };
}

function extractPlaceHoursDetails(result, fallbackOpenNow = null) {
  const openingHours = result?.opening_hours;
  const detailOpenNow =
    typeof openingHours?.open_now === "boolean"
      ? openingHours.open_now
      : typeof fallbackOpenNow === "boolean"
        ? fallbackOpenNow
        : null;
  const utcOffsetMinutes = Number.isFinite(result?.utc_offset)
    ? result.utc_offset
    : Number.isFinite(result?.utc_offset_minutes)
      ? result.utc_offset_minutes
      : null;
  const placeLocalDate = getPlaceLocalDate(utcOffsetMinutes);
  const localDayIndex = placeLocalDate ? placeLocalDate.getUTCDay() : null;
  const localTimeMinutes = placeLocalDate
    ? placeLocalDate.getUTCHours() * 60 + placeLocalDate.getUTCMinutes()
    : null;
  const todayHoursLabel = getTodayHoursLabel(openingHours?.weekday_text, localDayIndex);
  const periodDetails = resolveHoursPeriodDetails(openingHours?.periods, localDayIndex, localTimeMinutes);
  const isTwentyFourHours = typeof todayHoursLabel === "string" && /open 24 hours/i.test(todayHoursLabel);

  if (detailOpenNow === true) {
    return {
      open_now: true,
      hours_status_label: "Open now",
      hours_detail_label: periodDetails?.closingTimeLabel
        ? `Closes ${periodDetails.closingTimeLabel}`
        : isTwentyFourHours
          ? "Open 24 hours"
          : todayHoursLabel
            ? `Today: ${todayHoursLabel}`
            : null,
    };
  }

  if (detailOpenNow === false) {
    return {
      open_now: false,
      hours_status_label: "Closed now",
      hours_detail_label: periodDetails?.nextOpenLabel
        ? `Opens ${periodDetails.nextOpenLabel}`
        : todayHoursLabel
          ? `Today: ${todayHoursLabel}`
          : null,
    };
  }

  if (todayHoursLabel) {
    return {
      open_now: null,
      hours_status_label: "Hours today",
      hours_detail_label: todayHoursLabel,
    };
  }

  return {
    open_now: detailOpenNow,
    hours_status_label: "Hours unavailable",
    hours_detail_label: null,
  };
}

function extractPlacePhoneDetails(result) {
  const formattedPhoneNumber = sanitizeText(result?.formatted_phone_number);
  const internationalPhoneNumber = sanitizeText(result?.international_phone_number);

  return {
    phone_number: formattedPhoneNumber || internationalPhoneNumber || null,
    international_phone_number: internationalPhoneNumber || null,
    phone_link: buildPhoneLink(internationalPhoneNumber || formattedPhoneNumber),
  };
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
    place_id: place.place_id || null,
    google_maps_url: buildGoogleMapsUrl(place),
    coordinates:
      coordinates && Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng)
        ? { lat: coordinates.lat, lng: coordinates.lng }
        : null,
    distance_miles: distanceMiles,
    business_status: place.business_status || null,
    review_label: formatReviewLabel(place.user_ratings_total),
    phone_number: null,
    international_phone_number: null,
    phone_link: null,
    ...extractPlaceHoursDetails(place),
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

async function autocompleteLocationSuggestions(query, apiKey, { limit = 8, sessionToken } = {}) {
  const normalizedQuery = sanitizeText(query);

  if (!normalizedQuery) {
    return [];
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", normalizedQuery);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "en");

  if (sessionToken) {
    url.searchParams.set("sessiontoken", sessionToken);
  }

  const payload = await fetchJson(url);

  if (payload.status === "ZERO_RESULTS") {
    return [];
  }

  if (payload.status !== "OK" || !Array.isArray(payload.predictions)) {
    throw createGoogleApiError(
      payload.error_message || `Places autocomplete failed with status ${payload.status || "UNKNOWN"}.`,
      502,
      "places_autocomplete_failed",
    );
  }

  return payload.predictions.slice(0, Math.max(1, limit)).map((prediction) => {
    const structuredFormatting = prediction.structured_formatting || {};
    const description =
      sanitizeText(prediction.description) || sanitizeText(structuredFormatting.main_text) || normalizedQuery;
    const types = Array.isArray(prediction.types)
      ? prediction.types.filter((type) => typeof type === "string")
      : [];

    return {
      place_id: sanitizeText(prediction.place_id) || null,
      description,
      primary_text: sanitizeText(structuredFormatting.main_text) || description,
      secondary_text: sanitizeText(structuredFormatting.secondary_text) || null,
      types,
      type_label: getLocationSuggestionTypeLabel(types),
    };
  });
}

async function requestPlaceDetails(
  placeId,
  apiKey,
  fields,
  {
    sessionToken,
    missingPlaceMessage = "A Google place ID is required to resolve this location.",
    failureCode = "place_details_failed",
    failureLabel = "Place details",
  } = {},
) {
  const normalizedPlaceId = sanitizeText(placeId);

  if (!normalizedPlaceId) {
    throw createGoogleApiError(missingPlaceMessage, 400, "missing_place_id");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", normalizedPlaceId);
  url.searchParams.set("fields", fields);
  url.searchParams.set("key", apiKey);

  if (sessionToken) {
    url.searchParams.set("sessiontoken", sessionToken);
  }

  const payload = await fetchJson(url);

  if (payload.status !== "OK" || !payload.result) {
    throw createGoogleApiError(
      payload.error_message || `${failureLabel} failed with status ${payload.status || "UNKNOWN"}.`,
      502,
      failureCode,
    );
  }

  return payload.result;
}

async function getPlaceDetails(placeId, apiKey, { displayLabel, rawQuery, sessionToken } = {}) {
  const result = await requestPlaceDetails(
    placeId,
    apiKey,
    "address_component,formatted_address,geometry,name,place_id,type",
    {
      sessionToken,
      missingPlaceMessage: "A Google place ID is required to resolve this location.",
      failureCode: "place_details_failed",
      failureLabel: "Place details",
    },
  );

  return buildResolvedLocation({
    rawQuery,
    displayLabel,
    formattedAddress: result.formatted_address,
    name: result.name,
    placeId: result.place_id,
    coordinates: result.geometry?.location,
    components: result.address_components,
    types: result.types,
    resolutionSource: "place_details",
  });
}

async function getPlacePhoneDetails(placeId, apiKey, { sessionToken } = {}) {
  const result = await requestPlaceDetails(
    placeId,
    apiKey,
    "formatted_phone_number,international_phone_number,opening_hours,place_id,utc_offset",
    {
      sessionToken,
      missingPlaceMessage: "A Google place ID is required to look up pharmacy contact details.",
      failureCode: "place_phone_details_failed",
      failureLabel: "Place phone details",
    },
  );

  return {
    ...extractPlacePhoneDetails(result),
    ...extractPlaceHoursDetails(result),
  };
}

async function hydratePlacePhoneDetails(place, apiKey) {
  if (!place?.place_id) {
    return place;
  }

  try {
    return {
      ...place,
      ...(await getPlacePhoneDetails(place.place_id, apiKey)),
    };
  } catch {
    return place;
  }
}

async function geocodeLocation(location, apiKey, { displayLabel, rawQuery, components } = {}) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", location);
  url.searchParams.set("key", apiKey);

  if (components && typeof components === "object") {
    const serializedComponents = Object.entries(components)
      .map(([key, value]) => `${key}:${sanitizeText(value)}`)
      .filter((entry) => !entry.endsWith(":"))
      .join("|");

    if (serializedComponents) {
      url.searchParams.set("components", serializedComponents);
    }
  }

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

  return buildResolvedLocation({
    rawQuery: rawQuery || location,
    displayLabel,
    formattedAddress: match.formatted_address,
    name: null,
    placeId: match.place_id,
    coordinates: match.geometry?.location,
    components: match.address_components,
    types: match.types,
    resolutionSource: "geocode",
  });
}

async function resolveLocationInput({ query, placeId, sessionToken } = {}, apiKey) {
  const normalizedQuery = sanitizeText(query);
  const normalizedPlaceId = sanitizeText(placeId);

  if (!normalizedQuery && !normalizedPlaceId) {
    const error = new Error("Location is required.");
    error.statusCode = 400;
    error.code = "missing_location";
    throw error;
  }

  if (normalizedPlaceId) {
    return getPlaceDetails(normalizedPlaceId, apiKey, {
      displayLabel: normalizedQuery || undefined,
      rawQuery: normalizedQuery || undefined,
      sessionToken,
    });
  }

  if (isLikelyUsPostalCode(normalizedQuery)) {
    try {
      return await geocodeLocation(normalizedQuery, apiKey, {
        rawQuery: normalizedQuery,
        components: {
          postal_code: normalizedQuery,
          country: "US",
        },
      });
    } catch (error) {
      if (error?.code !== "location_not_found") {
        throw error;
      }
    }
  }

  try {
    const [topSuggestion] = await autocompleteLocationSuggestions(normalizedQuery, apiKey, {
      limit: 1,
      sessionToken,
    });

    if (topSuggestion?.place_id) {
      return getPlaceDetails(topSuggestion.place_id, apiKey, {
        displayLabel: topSuggestion.description,
        rawQuery: normalizedQuery,
        sessionToken,
      });
    }
  } catch (error) {
    // Fall back to geocoding so direct address/city/ZIP searches can still resolve
    // even when autocomplete has no usable prediction.
  }

  return geocodeLocation(normalizedQuery, apiKey, {
    rawQuery: normalizedQuery,
  });
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

  const sortedResults = await Promise.all(
    sortResults(normalizedResults, sortBy, medicationProfile)
      .slice(0, MAX_RESULTS)
      .map((place) =>
        hydratePlacePhoneDetails(
          {
            ...place,
            ...buildPlaceWorkflow(place, medicationProfile, medication),
          },
          apiKey,
        ),
      ),
  );
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
    locationPlaceId: sanitizeText(source.locationPlaceId || source.location_place_id),
    radiusMiles: normalizeRadiusMiles(source.radiusMiles || source.radius_miles),
    onlyOpenNow: normalizeBoolean(source.onlyOpenNow || source.only_open_now),
    sortBy: normalizeSortBy(source.sortBy || source.sort_by),
  };
}

module.exports = {
  SEARCH_DISCLAIMER,
  autocompleteLocationSuggestions,
  extractStructuredLocationFields,
  geocodeLocation,
  getPlaceDetails,
  getSearchInput,
  readJsonBody,
  resolveLocationInput,
  searchNearbyPharmacies,
  sendJson,
};
