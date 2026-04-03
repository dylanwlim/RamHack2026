import {
  buildMedicationQueryLabel,
  normalizeStrengthValue,
} from "@/lib/medications/selection";
import type {
  MedicationSearchOption,
  MedicationSearchResponse,
} from "@/lib/medications/types";

const MEDICATION_SEARCH_CACHE_LIMIT = 48;
const MEDICATION_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const MEDICATION_SELECTION_CACHE_LIMIT = 96;
const MEDICATION_SELECTION_CACHE_TTL_MS = 30 * 60 * 1000;
const MEDICATION_SEARCH_STORAGE_KEY = "pharmapath:medications:search:v2";
const MEDICATION_SELECTION_STORAGE_KEY = "pharmapath:medications:selection:v2";
const RELEASE_TOKEN_EXPANSIONS = new Map([
  ["xr", "extended release"],
  ["er", "extended release"],
  ["xl", "extended release"],
  ["sr", "extended release"],
  ["ir", "immediate release"],
  ["dr", "delayed release"],
  ["odt", "orally disintegrating"],
]);
const medicationSearchCache = new Map<
  string,
  { storedAt: number; payload: MedicationSearchResponse }
>();
const medicationSearchInFlight = new Map<string, Promise<MedicationSearchResponse>>();
const medicationSelectionCache = new Map<string, MedicationSearchOption>();
let medicationCacheHydrated = false;
let medicationSearchPrewarmPromise: Promise<MedicationSearchResponse> | null = null;

function sanitizeText(value = "") {
  return String(value).trim();
}

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function expandMedicationQueryTokens(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .flatMap((token) => {
      const expansion = RELEASE_TOKEN_EXPANSIONS.get(token);
      return expansion ? expansion.split(" ") : [token];
    })
    .join(" ");
}

function createMedicationTokenSignature(value: string) {
  return Array.from(
    new Set(
      normalizeMedicationSearchQuery(value)
        .split(" ")
        .filter(Boolean),
    ),
  )
    .sort()
    .join("|");
}

export function normalizeMedicationSearchQuery(value: string) {
  const normalized = sanitizeText(value)
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/[^\p{L}\p{N}%/+.,-]+/gu, " ")
    .replace(/,/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return expandMedicationQueryTokens(normalized);
}

function buildSearchableMedicationText(option: MedicationSearchOption) {
  return normalizeMedicationSearchQuery(
    [
      option.label,
      option.value,
      option.description,
      option.canonicalName,
      option.canonicalLabel,
      option.formulation,
      option.dosageForm,
      option.route,
      option.matchedStrength,
      ...option.strengths.map((strength) => strength.value),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function scoreMedicationOptionLocally(
  option: MedicationSearchOption,
  normalizedQuery: string,
  exact = false,
) {
  if (!normalizedQuery) {
    return Number.POSITIVE_INFINITY;
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const querySignature = createMedicationTokenSignature(normalizedQuery);
  const aliasCandidates = [
    option.label,
    option.value,
    option.canonicalName,
    option.canonicalLabel,
    option.matchedStrength,
    ...option.strengths.map((strength) => strength.value),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeMedicationSearchQuery(value));
  let bestScore = Number.POSITIVE_INFINITY;

  aliasCandidates.forEach((alias) => {
    if (!alias) {
      return;
    }

    if (alias === normalizedQuery) {
      bestScore = Math.min(bestScore, 0);
      return;
    }

    if (querySignature && createMedicationTokenSignature(alias) === querySignature) {
      bestScore = Math.min(bestScore, 4);
      return;
    }

    if (alias.startsWith(normalizedQuery)) {
      bestScore = Math.min(bestScore, 10 + alias.length / 1000);
      return;
    }

    if (alias.includes(` ${normalizedQuery}`)) {
      bestScore = Math.min(bestScore, 18);
      return;
    }

    if (alias.includes(normalizedQuery)) {
      bestScore = Math.min(bestScore, 26);
    }
  });

  if (exact || bestScore !== Number.POSITIVE_INFINITY) {
    return bestScore;
  }

  const searchableText = buildSearchableMedicationText(option);
  if (queryTokens.length && queryTokens.every((token) => searchableText.includes(token))) {
    return 40 + queryTokens.length;
  }

  return Number.POSITIVE_INFINITY;
}

function sortMedicationOptions(left: MedicationSearchOption, right: MedicationSearchOption) {
  return left.label.localeCompare(right.label);
}

function findMatchingMedicationOptions(
  query: string,
  options: MedicationSearchOption[],
  { exact = false, limit = 8 }: { exact?: boolean; limit?: number } = {},
) {
  const normalizedQuery = normalizeMedicationSearchQuery(query);

  return options
    .map((option) => ({
      option,
      score: scoreMedicationOptionLocally(option, normalizedQuery, exact),
    }))
    .filter((entry) => entry.score !== Number.POSITIVE_INFINITY)
    .sort(
      (left, right) =>
        left.score - right.score || sortMedicationOptions(left.option, right.option),
    )
    .slice(0, limit)
    .map((entry) => entry.option);
}

function trimSelectionCache() {
  if (medicationSelectionCache.size <= MEDICATION_SELECTION_CACHE_LIMIT) {
    return;
  }

  const oldestKey = medicationSelectionCache.keys().next().value;
  if (oldestKey) {
    medicationSelectionCache.delete(oldestKey);
  }
}

function readPersistedEntries<T>(
  storageKey: string,
): Record<string, { storedAt: number; payload: T }> {
  if (!canUseSessionStorage()) {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<
      string,
      { storedAt?: number; payload?: T }
    >;
    const entries = Object.entries(parsed).filter(
      ([, entry]) => Boolean(entry?.storedAt && entry.payload),
    );

    return Object.fromEntries(
      entries.map(([key, entry]) => [
        key,
        { storedAt: entry.storedAt as number, payload: entry.payload as T },
      ]),
    );
  } catch {
    return {};
  }
}

function writePersistedEntries<T>(
  storageKey: string,
  entries: Array<[string, { storedAt: number; payload: T }]>,
) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    return;
  }
}

function persistMedicationSelectionCache() {
  writePersistedEntries(
    MEDICATION_SELECTION_STORAGE_KEY,
    Array.from(medicationSelectionCache.entries())
      .slice(-MEDICATION_SELECTION_CACHE_LIMIT)
      .map(([key, payload]) => [key, { storedAt: Date.now(), payload }] as const),
  );
}

function persistMedicationSearchCache() {
  writePersistedEntries(
    MEDICATION_SEARCH_STORAGE_KEY,
    Array.from(medicationSearchCache.entries())
      .filter(([, entry]) => Date.now() - entry.storedAt <= MEDICATION_SEARCH_CACHE_TTL_MS)
      .slice(-MEDICATION_SEARCH_CACHE_LIMIT),
  );
}

function hydrateMedicationCaches() {
  if (medicationCacheHydrated || !canUseSessionStorage()) {
    return;
  }

  medicationCacheHydrated = true;
  const now = Date.now();

  const persistedSearchEntries = Object.entries(
    readPersistedEntries<MedicationSearchResponse>(MEDICATION_SEARCH_STORAGE_KEY),
  )
    .filter(([, entry]) => now - entry.storedAt <= MEDICATION_SEARCH_CACHE_TTL_MS)
    .sort((left, right) => left[1].storedAt - right[1].storedAt);

  persistedSearchEntries.forEach(([cacheKey, entry]) => {
    medicationSearchCache.set(cacheKey, entry);
    entry.payload.results.forEach((option) => rememberMedicationSelection(option, false));
  });

  const persistedSelectionEntries = Object.entries(
    readPersistedEntries<MedicationSearchOption>(MEDICATION_SELECTION_STORAGE_KEY),
  )
    .filter(([, entry]) => now - entry.storedAt <= MEDICATION_SELECTION_CACHE_TTL_MS)
    .sort((left, right) => left[1].storedAt - right[1].storedAt);

  persistedSelectionEntries.forEach(([key, entry]) => {
    medicationSelectionCache.set(key, entry.payload);
    trimSelectionCache();
  });

  persistMedicationSearchCache();
  persistMedicationSelectionCache();
}

function rememberMedicationSelection(
  option: MedicationSearchOption,
  persist = true,
) {
  const baseOption = {
    ...option,
    matchedStrength: option.matchedStrength
      ? normalizeStrengthValue(option.matchedStrength)
      : option.matchedStrength ?? null,
  };
  const variants = [
    baseOption,
    ...baseOption.strengths.map((strength) => ({
      ...baseOption,
      matchedStrength: strength.value,
    })),
  ];

  variants.forEach((variant) => {
    const keys = new Set(
      [
        variant.label,
        variant.value,
        variant.canonicalLabel,
        variant.canonicalName,
        variant.matchedStrength
          ? `${variant.label} ${variant.matchedStrength}`
          : null,
        variant.matchedStrength
          ? `${variant.canonicalName} ${variant.matchedStrength}`
          : null,
        variant.matchedStrength
          ? buildMedicationQueryLabel(variant, variant.matchedStrength)
          : null,
      ]
        .filter(Boolean)
        .map((value) => normalizeMedicationSearchQuery(value as string)),
    );

    keys.forEach((key) => {
      medicationSelectionCache.delete(key);
      medicationSelectionCache.set(key, variant);
      trimSelectionCache();
    });
  });

  if (persist) {
    persistMedicationSelectionCache();
  }
}

function rememberMedicationSelectionsFromResponse(payload: MedicationSearchResponse) {
  payload.results.forEach((option) => rememberMedicationSelection(option, false));
  persistMedicationSelectionCache();
}

function buildCacheKey(query: string, exact: boolean, limit: number) {
  return JSON.stringify({
    query: normalizeMedicationSearchQuery(query),
    exact,
    limit,
  });
}

function createAbortError() {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Medication search was aborted.", "AbortError");
  }

  const error = new Error("Medication search was aborted.");
  error.name = "AbortError";
  return error;
}

function rememberMedicationSearch(
  cacheKey: string,
  payload: MedicationSearchResponse,
) {
  hydrateMedicationCaches();
  medicationSearchCache.delete(cacheKey);
  medicationSearchCache.set(cacheKey, {
    storedAt: Date.now(),
    payload,
  });
  rememberMedicationSelectionsFromResponse(payload);

  if (medicationSearchCache.size > MEDICATION_SEARCH_CACHE_LIMIT) {
    const oldestKey = medicationSearchCache.keys().next().value;
    if (oldestKey) {
      medicationSearchCache.delete(oldestKey);
    }
  }

  persistMedicationSearchCache();
}

function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal) {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(createAbortError());

    signal.addEventListener("abort", handleAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", handleAbort);
        reject(error);
      },
    );
  });
}

async function requestMedicationSearch(
  query: string,
  {
    exact = false,
    limit = 8,
  }: {
    exact?: boolean;
    limit?: number;
  } = {},
) {
  const normalizedQuery = normalizeMedicationSearchQuery(query);
  const cacheKey = buildCacheKey(normalizedQuery, exact, limit);

  const params = new URLSearchParams({
    q: normalizedQuery,
    limit: String(limit),
  });

  if (exact) {
    params.set("exact", "1");
  }

  const response = await fetch(`/api/medications/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  const payload = (await response.json().catch(() => null)) as MedicationSearchResponse | {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload && "error" in payload && payload.error ? payload.error : "Unable to search medications right now.");
  }

  rememberMedicationSearch(cacheKey, payload as MedicationSearchResponse);
  return payload as MedicationSearchResponse;
}

async function fetchMedicationSearch(
  query: string,
  {
    exact = false,
    limit = 8,
    signal,
  }: {
    exact?: boolean;
    limit?: number;
    signal?: AbortSignal;
  } = {},
) {
  hydrateMedicationCaches();
  const normalizedQuery = normalizeMedicationSearchQuery(query);
  const cacheKey = buildCacheKey(normalizedQuery, exact, limit);
  const cached = medicationSearchCache.get(cacheKey);

  if (cached && Date.now() - cached.storedAt <= MEDICATION_SEARCH_CACHE_TTL_MS) {
    medicationSearchCache.delete(cacheKey);
    medicationSearchCache.set(cacheKey, cached);
    return cached.payload;
  }

  if (cached) {
    medicationSearchCache.delete(cacheKey);
    persistMedicationSearchCache();
  }

  let inFlight = medicationSearchInFlight.get(cacheKey);

  if (!inFlight) {
    inFlight = requestMedicationSearch(normalizedQuery, { exact, limit }).finally(() => {
      medicationSearchInFlight.delete(cacheKey);
    });
    medicationSearchInFlight.set(cacheKey, inFlight);
  }

  return withAbortSignal(inFlight, signal);
}

export async function searchMedicationIndex(
  query: string,
  options: {
    limit?: number;
    signal?: AbortSignal;
  } = {},
) {
  return fetchMedicationSearch(query, options);
}

export function getCachedMedicationSelection(
  query: string,
  selectedStrength?: string | null,
) {
  hydrateMedicationCaches();
  const normalizedQuery = normalizeMedicationSearchQuery(query);
  const normalizedStrength = normalizeStrengthValue(selectedStrength || "");
  const lookupKeys = [
    normalizedStrength
      ? normalizeMedicationSearchQuery(`${query} ${normalizedStrength}`)
      : null,
    normalizedQuery,
  ].filter(Boolean) as string[];

  for (const key of lookupKeys) {
    const cached = medicationSelectionCache.get(key);
    if (cached) {
      medicationSelectionCache.delete(key);
      medicationSelectionCache.set(key, cached);
      return normalizedStrength && cached.matchedStrength !== normalizedStrength
        ? { ...cached, matchedStrength: normalizedStrength }
        : cached;
    }
  }

  return null;
}

export function getMedicationSearchPreview(
  query: string,
  { limit = 8 }: { limit?: number } = {},
) {
  hydrateMedicationCaches();
  const normalizedQuery = normalizeMedicationSearchQuery(query);

  if (!normalizedQuery) {
    return null;
  }

  const exactCacheKey = buildCacheKey(normalizedQuery, false, limit);
  const exactCached = medicationSearchCache.get(exactCacheKey);
  if (
    exactCached &&
    Date.now() - exactCached.storedAt <= MEDICATION_SEARCH_CACHE_TTL_MS
  ) {
    return exactCached.payload;
  }

  let bestPreviewQuery = "";
  let bestPreviewPayload: MedicationSearchResponse | null = null;

  for (const entry of medicationSearchCache.values()) {
    if (Date.now() - entry.storedAt > MEDICATION_SEARCH_CACHE_TTL_MS) {
      continue;
    }

    const candidateQuery = normalizeMedicationSearchQuery(entry.payload.query);
    if (
      !candidateQuery ||
      candidateQuery === normalizedQuery ||
      !normalizedQuery.startsWith(candidateQuery)
    ) {
      continue;
    }

    if (!bestPreviewPayload || candidateQuery.length > bestPreviewQuery.length) {
      bestPreviewQuery = candidateQuery;
      bestPreviewPayload = entry.payload;
    }
  }

  if (!bestPreviewPayload) {
    return null;
  }

  const filteredResults = findMatchingMedicationOptions(
    normalizedQuery,
    bestPreviewPayload.results,
    { limit },
  );

  if (!filteredResults.length) {
    return null;
  }

  return {
    ...bestPreviewPayload,
    query: normalizedQuery,
    results: filteredResults,
  } satisfies MedicationSearchResponse;
}

export async function resolveMedicationOption(query: string) {
  hydrateMedicationCaches();
  const cachedSelection = getCachedMedicationSelection(query);
  if (cachedSelection) {
    return cachedSelection;
  }

  const exactResponse = await fetchMedicationSearch(query, { exact: true, limit: 1 });
  const exactOption = exactResponse.results[0] || null;

  if (exactOption) {
    return exactOption;
  }

  const fallbackResponse = await fetchMedicationSearch(query, { limit: 2 });
  return fallbackResponse.results.length === 1 ? fallbackResponse.results[0] : null;
}

export function prewarmMedicationSearch() {
  hydrateMedicationCaches();
  const featuredCacheKey = buildCacheKey("", false, 8);
  const cached = medicationSearchCache.get(featuredCacheKey);

  if (cached && Date.now() - cached.storedAt <= MEDICATION_SEARCH_CACHE_TTL_MS) {
    return Promise.resolve(cached.payload);
  }

  if (medicationSearchPrewarmPromise) {
    return medicationSearchPrewarmPromise;
  }

  medicationSearchPrewarmPromise = fetchMedicationSearch("", { limit: 8 }).finally(() => {
    medicationSearchPrewarmPromise = null;
  });

  return medicationSearchPrewarmPromise;
}

export type { MedicationSearchOption };
