"use strict";

const DEFAULT_RADIUS_MILES = 5;
const MAX_RADIUS_MILES = 25;
const MAX_RESULTS = 12;
const SEARCH_DISCLAIMER =
  "Showing nearby pharmacies for your medication search. Real-time inventory availability is not yet verified.";

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

  return 2 * earthRadiusMiles * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));
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

function getBestMatchScore(place) {
  const openBoost = place.open_now === true ? 40 : place.open_now === false ? -15 : 0;
  const ratingBoost = place.rating ? place.rating * 10 : 0;
  const reviewBoost = place.user_ratings_total
    ? Math.min(Math.log10(place.user_ratings_total + 1) * 8, 20)
    : 0;
  const distancePenalty = place.distance_miles ? place.distance_miles * 4 : 40;

  return openBoost + ratingBoost + reviewBoost - distancePenalty;
}

function sortResults(results, sortBy) {
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
      getBestMatchScore(right) - getBestMatchScore(left) ||
      (left.distance_miles ?? Number.POSITIVE_INFINITY) -
        (right.distance_miles ?? Number.POSITIVE_INFINITY)
    );
  });

  return sorted;
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

async function searchNearbyPharmacies({ medication, center, radiusMiles, onlyOpenNow, apiKey, sortBy }) {
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
        .filter(
          (place) => place.distance_miles === null || place.distance_miles <= radiusMiles,
        )
    : [];

  const sortedResults = sortResults(normalizedResults, sortBy).slice(0, MAX_RESULTS);

  return {
    disclaimer: SEARCH_DISCLAIMER,
    medication_context: medication,
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
