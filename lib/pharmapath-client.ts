"use client";

export type PharmacySearchFilters = {
  medication: string;
  location: string;
  locationPlaceId?: string;
  radiusMiles?: number;
  sortBy?: "best_match" | "distance" | "rating";
  onlyOpenNow?: boolean;
};

export type PharmacySearchResponse = {
  status: string;
  query: {
    medication: string;
    location: string;
    location_place_id?: string | null;
    radius_miles: number;
    only_open_now: boolean;
    sort_by: string;
  };
  location: {
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
  disclaimer: string;
  medication_profile: {
    key: string;
    label: string;
    workflow_label: string;
    source?: "openfda" | "demo";
    demo_only?: boolean;
    demo_note?: string | null;
    simulated_user_count?: number | null;
    medication_label?: string;
    selected_strength?: string | null;
    dosage_form?: string | null;
    formulation?: string | null;
  };
  guidance: {
    title: string;
    summary: string;
    ranking_focus: string;
    ranking_focus_label: string;
    recommended_action: string;
    questions_to_ask: string[];
    tags: string[];
    real_signal: string;
    demo_boundary: string;
  };
  results: Array<{
    name: string;
    address: string;
    rating: number | null;
    user_ratings_total: number | null;
    open_now: boolean | null;
    place_id: string | null;
    google_maps_url: string | null;
    distance_miles: number | null;
    business_status: string | null;
    review_label: string;
    workflow_label: string;
    match_reason: string;
    next_step: string;
    inventory_note: string;
  }>;
  recommended: PharmacySearchResponse["results"][number] | null;
  counts: {
    total: number;
    open_now: number;
    hours_unknown: number;
  };
};

export type DrugIntelligenceResponse = {
  query: {
    raw: string;
  };
  featured_match_id?: string | null;
  data_source?: "openfda" | "demo";
  demo_context?: {
    demo_only: boolean;
    source_label: string;
    note: string | null;
    simulated_user_count: number | null;
    selected_strength: string | null;
    selected_label: string | null;
  };
  data_freshness: {
    ndc_last_updated?: string | null;
    shortages_last_updated?: string | null;
    recalls_last_updated?: string | null;
  };
  methodology_summary?: string;
  limitations?: string[];
  matches: Array<{
    id: string;
    display_name: string;
    canonical_label: string;
    active_listing_count: number;
    manufacturers: string[];
    strengths: string[];
    routes: string[];
    dosage_forms: string[];
    application_numbers: string[];
    data_source?: "openfda" | "demo";
    demo_context?: {
      demo_only: boolean;
      source_label: string;
      note: string | null;
      simulated_user_count: number | null;
      selected_strength: string | null;
      selected_label: string | null;
    };
    access_signal: {
      level: "steadier" | "mixed" | "higher-friction";
      label: string;
      confidence_label: string;
      patient_summary: string;
      prescriber_summary: string;
      reasoning: string[];
    };
    patient_view: {
      summary: string;
      what_we_know: string[];
      what_may_make_it_harder: string[];
      questions_to_ask: string[];
      unavailable: string[];
    };
    prescriber_view: {
      summary: string;
      takeaways: string[];
      should_consider_alternatives: boolean;
    };
    evidence: {
      shortages: {
        active_count: number;
        items: Array<{
          status: string;
          normalizedStatus?: string;
          presentation?: string;
          companyName?: string;
          shortageReason?: string;
          availability?: string;
          updateDate?: string | null;
          updateLabel?: string;
        }>;
      };
      recalls: {
        recent_count: number;
        items: Array<{
          classification?: string;
          status?: string;
          reason?: string;
          productDescription?: string;
          reportDateLabel?: string;
          recallingFirm?: string;
        }>;
      };
      approvals: {
        sponsor_name?: string;
        latest_submission_label?: string;
        recent_manufacturing_updates: Array<{
          type: string;
          date_label: string;
          status: string;
        }>;
        recent_labeling_updates: Array<{
          type: string;
          date_label: string;
          status: string;
        }>;
      };
    };
  }>;
};

export type HealthResponse = {
  status: string;
  data_source?: string;
  google_api_configured?: boolean;
  openfda_api_key_configured?: boolean;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const DRUG_CACHE_PREFIX = "pharmapath:drug:";
const PHARMACY_CACHE_PREFIX = "pharmapath:pharmacy:";

function sanitizeText(value = "") {
  return String(value).trim();
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

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { storedAt?: number; payload?: T };
    if (!parsed.storedAt || !parsed.payload) {
      return null;
    }

    if (Date.now() - parsed.storedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed.payload;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, payload: T) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        storedAt: Date.now(),
        payload,
      }),
    );
  } catch {
    // Ignore storage failures and keep the live response.
  }
}

function buildDrugCacheKey(query: string) {
  return `${DRUG_CACHE_PREFIX}${sanitizeText(query).toLowerCase()}`;
}

function buildPharmacyCacheKey(filters: PharmacySearchFilters) {
  return `${PHARMACY_CACHE_PREFIX}${JSON.stringify({
    medication: sanitizeText(filters.medication).toLowerCase(),
    location: sanitizeText(filters.location).toLowerCase(),
    locationPlaceId: sanitizeText(filters.locationPlaceId || "").toLowerCase(),
    radiusMiles: Number(filters.radiusMiles || 5),
    sortBy: filters.sortBy || "best_match",
    onlyOpenNow: Boolean(filters.onlyOpenNow),
  })}`;
}

function buildPharmacyPayload(filters: PharmacySearchFilters) {
  return {
    medication: sanitizeText(filters.medication),
    location: sanitizeText(filters.location),
    locationPlaceId: sanitizeText(filters.locationPlaceId || "") || undefined,
    radiusMiles: Number(filters.radiusMiles || 5),
    sortBy: filters.sortBy || "best_match",
    onlyOpenNow: Boolean(filters.onlyOpenNow),
  };
}

export function createPharmaPathClient({
  fetchImpl = fetch,
}: {
  fetchImpl?: typeof fetch;
} = {}) {
  return {
    readCachedDossier(query: string) {
      return readCache<DrugIntelligenceResponse>(buildDrugCacheKey(query));
    },

    async getDrugIntelligence(query: string, { force = false }: { force?: boolean } = {}) {
      const normalizedQuery = sanitizeText(query);

      if (!normalizedQuery) {
        throw new Error("A medication query is required.");
      }

      if (!force) {
        const cached = readCache<DrugIntelligenceResponse>(buildDrugCacheKey(normalizedQuery));
        if (cached) {
          return cached;
        }
      }

      const response = await fetchImpl(
        `/api/drug-intelligence?query=${encodeURIComponent(normalizedQuery)}`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Unable to load medication intelligence right now."),
        );
      }

      writeCache(buildDrugCacheKey(normalizedQuery), payload);
      return payload as DrugIntelligenceResponse;
    },

    async searchPharmacies(
      filters: PharmacySearchFilters,
      { force = false }: { force?: boolean } = {},
    ) {
      const normalizedPayload = buildPharmacyPayload(filters);

      if (!normalizedPayload.medication) {
        throw new Error("Medication is required.");
      }

      if (!normalizedPayload.location) {
        throw new Error("Location is required.");
      }

      const cacheKey = buildPharmacyCacheKey(normalizedPayload);

      if (!force) {
        const cached = readCache<PharmacySearchResponse>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const response = await fetchImpl("/api/pharmacies/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(normalizedPayload),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to search nearby pharmacies right now."));
      }

      writeCache(cacheKey, payload);
      return payload as PharmacySearchResponse;
    },

    async getHealth() {
      const response = await fetchImpl("/api/health", {
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to load health status."));
      }

      return payload as HealthResponse;
    },
  };
}
