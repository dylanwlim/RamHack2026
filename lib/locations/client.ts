"use client";

export type LocationSuggestion = {
  placeId: string;
  description: string;
  primaryText: string;
  secondaryText: string | null;
  types: string[];
  typeLabel: string;
};

export type ResolvedLocation = {
  raw_query: string;
  display_label: string;
  formatted_address: string;
  name: string | null;
  place_id: string | null;
  coordinates: {
    lat: number;
    lng: number;
  };
  types: string[];
  resolution_source: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  neighborhood: string | null;
  country: string | null;
  country_code: string | null;
  route: string | null;
  street_number: string | null;
};

type LocationSuggestionResponse = {
  status: string;
  results: Array<{
    place_id: string | null;
    description: string;
    primary_text: string;
    secondary_text: string | null;
    types: string[];
    type_label: string;
  }>;
};

type LocationResolveResponse = {
  status: string;
  location: ResolvedLocation;
};

const DIRECT_LOCATION_SEARCH_FALLBACK_CODES = new Set([
  "missing_google_api_key",
  "google_api_error",
  "google_api_timeout",
  "places_autocomplete_failed",
  "place_details_failed",
  "geocoding_failed",
]);

function sanitizeText(value = "") {
  return String(value).trim();
}

function getErrorCode(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    typeof payload.code === "string" &&
    payload.code.trim()
  ) {
    return payload.code.trim();
  }

  return "";
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error.trim();
  }

  return fallback;
}

export class LocationRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "LocationRequestError";
    this.code = sanitizeText(code) || undefined;
  }
}

function createLocationRequestError(payload: unknown, fallback: string) {
  return new LocationRequestError(
    getErrorMessage(payload, fallback),
    getErrorCode(payload),
  );
}

export function createLocationSessionToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `loc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function searchLocationSuggestions(
  query: string,
  {
    limit = 8,
    signal,
    sessionToken,
  }: {
    limit?: number;
    signal?: AbortSignal;
    sessionToken?: string;
  } = {},
) {
  const normalizedQuery = sanitizeText(query);

  if (normalizedQuery.length < 2) {
    return {
      results: [] as LocationSuggestion[],
    };
  }

  const params = new URLSearchParams({
    q: normalizedQuery,
    limit: String(limit),
  });

  if (sessionToken) {
    params.set("sessionToken", sessionToken);
  }

  const response = await fetch(`/api/locations/autocomplete?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  const payload = (await response.json().catch(() => null)) as LocationSuggestionResponse | null;

  if (!response.ok) {
    throw createLocationRequestError(payload, "Unable to load location suggestions right now.");
  }

  return {
    results: (payload?.results || [])
      .filter((item) => item.place_id)
      .map((item) => ({
        placeId: item.place_id as string,
        description: item.description,
        primaryText: item.primary_text,
        secondaryText: item.secondary_text,
        types: item.types,
        typeLabel: item.type_label,
      })),
  };
}

export async function resolveLocationQuery(
  {
    query,
    placeId,
    sessionToken,
  }: {
    query: string;
    placeId?: string | null;
    sessionToken?: string;
  },
  { signal }: { signal?: AbortSignal } = {},
) {
  const normalizedQuery = sanitizeText(query);
  const normalizedPlaceId = sanitizeText(placeId || "");

  if (!normalizedQuery && !normalizedPlaceId) {
    throw new Error("Enter a city, ZIP, address, pharmacy, or landmark.");
  }

  const response = await fetch("/api/locations/resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: normalizedQuery,
      placeId: normalizedPlaceId || undefined,
      sessionToken: sessionToken || undefined,
    }),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as LocationResolveResponse | null;

  if (!response.ok || !payload?.location) {
    throw createLocationRequestError(payload, "Unable to resolve that location right now.");
  }

  return payload.location;
}

export function canFallbackToDirectLocationSearch(error: unknown) {
  if (!(error instanceof LocationRequestError)) {
    return false;
  }

  return Boolean(error.code && DIRECT_LOCATION_SEARCH_FALLBACK_CODES.has(error.code));
}
