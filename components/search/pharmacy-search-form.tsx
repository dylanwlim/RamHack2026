"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LocationCombobox } from "@/components/search/location-combobox";
import { MedicationCombobox } from "@/components/search/medication-combobox";
import { MedicationStrengthField } from "@/components/search/medication-strength-field";
import { featuredSearches } from "@/lib/content";
import {
  canFallbackToDirectLocationSearch,
  createLocationSessionToken,
  resolveLocationQuery,
} from "@/lib/locations/client";
import {
  getCachedMedicationSelection,
  resolveMedicationOption,
  type MedicationSearchOption,
} from "@/lib/medications/client";
import {
  buildMedicationQueryLabel,
  inferMatchedStrength,
} from "@/lib/medications/selection";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

type PharmacySearchFormProps = {
  initialMedication?: string;
  initialLocation?: string;
  initialLocationPlaceId?: string;
  initialRadiusMiles?: number;
  initialSortBy?: "best_match" | "distance" | "rating";
  initialOnlyOpenNow?: boolean;
  initialSelectedStrength?: string;
  action?: string;
  compact?: boolean;
  submitLabel?: string;
  showSamples?: boolean;
  className?: string;
};

function buildResultsHref({
  medication,
  location,
  locationPlaceId,
  radiusMiles,
  sortBy,
  onlyOpenNow,
  action = "/pharmacy-finder/results",
}: {
  medication: string;
  location: string;
  locationPlaceId?: string | null;
  radiusMiles: number;
  sortBy: string;
  onlyOpenNow: boolean;
  action?: string;
}) {
  const params = new URLSearchParams({
    query: medication.trim(),
    location: location.trim(),
    radiusMiles: String(radiusMiles),
    sortBy,
    onlyOpenNow: String(onlyOpenNow),
  });

  if (locationPlaceId) {
    params.set("locationPlaceId", locationPlaceId);
  }

  return `${action}?${params.toString()}`;
}

type LocationSelection = {
  label: string;
  placeId: string | null;
};

function createLocationSelection(label: string, placeId?: string | null) {
  const trimmedLabel = label.trim();

  if (!trimmedLabel) {
    return null;
  }

  return {
    label: trimmedLabel,
    placeId: placeId?.trim() || null,
  } satisfies LocationSelection;
}

export function PharmacySearchForm({
  initialMedication = "",
  initialLocation = "",
  initialLocationPlaceId = "",
  initialRadiusMiles = 5,
  initialSortBy = "best_match",
  initialOnlyOpenNow = false,
  initialSelectedStrength = "",
  action = "/pharmacy-finder/results",
  compact = false,
  submitLabel = "Search live nearby pharmacies",
  showSamples = false,
  className,
}: PharmacySearchFormProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [medicationOption, setMedicationOption] =
    useState<MedicationSearchOption | null>(() =>
      getCachedMedicationSelection(initialMedication, initialSelectedStrength),
    );
  const [medication, setMedication] = useState(() => {
    const cachedSelection = getCachedMedicationSelection(
      initialMedication,
      initialSelectedStrength,
    );

    return cachedSelection?.label || initialMedication;
  });
  const [selectedStrength, setSelectedStrength] = useState(() => {
    const cachedSelection = getCachedMedicationSelection(
      initialMedication,
      initialSelectedStrength,
    );

    return initialSelectedStrength.trim() || cachedSelection?.matchedStrength || "";
  });
  const [locationSelection, setLocationSelection] = useState<LocationSelection | null>(() =>
    createLocationSelection(initialLocation, initialLocationPlaceId),
  );
  const [location, setLocation] = useState(initialLocation);
  const [radiusMiles, setRadiusMiles] = useState(initialRadiusMiles);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [onlyOpenNow, setOnlyOpenNow] = useState(initialOnlyOpenNow);
  const [medicationError, setMedicationError] = useState<string | null>(null);
  const [strengthError, setStrengthError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isResolvingSearch, setIsResolvingSearch] = useState(false);
  const [locationSessionToken, setLocationSessionToken] = useState(createLocationSessionToken);

  useEffect(() => {
    let cancelled = false;
    const resolvedInitialStrength = initialSelectedStrength.trim();
    const cachedSelection = getCachedMedicationSelection(
      initialMedication,
      resolvedInitialStrength,
    );

    setMedicationOption(cachedSelection);
    setMedication(cachedSelection?.label || initialMedication);
    setSelectedStrength(
      resolvedInitialStrength || cachedSelection?.matchedStrength || "",
    );
    setMedicationError(null);
    setStrengthError(null);

    if (!initialMedication || cachedSelection) {
      return () => {
        cancelled = true;
      };
    }

    void resolveMedicationOption(initialMedication)
      .then((option) => {
        if (cancelled || !option) {
          return;
        }

        setMedicationOption(option);
        setMedication(option.label);
        setSelectedStrength(
          resolvedInitialStrength ||
            option.matchedStrength ||
            inferMatchedStrength(initialMedication, option.strengths) ||
            (option.strengths.length === 1 ? option.strengths[0].value : ""),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setMedication(initialMedication);
          setSelectedStrength(resolvedInitialStrength);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialMedication, initialSelectedStrength]);

  useEffect(() => {
    const nextLocationSelection = createLocationSelection(initialLocation, initialLocationPlaceId);
    setLocationSelection(nextLocationSelection);
    setLocation(nextLocationSelection?.label || initialLocation);
  }, [initialLocation, initialLocationPlaceId]);

  useEffect(() => {
    setRadiusMiles(initialRadiusMiles);
  }, [initialRadiusMiles]);

  useEffect(() => {
    setSortBy(initialSortBy);
  }, [initialSortBy]);

  useEffect(() => {
    setOnlyOpenNow(initialOnlyOpenNow);
  }, [initialOnlyOpenNow]);

  useEffect(() => {
    if (!initialLocation && !location && profile?.defaultLocationLabel) {
      const nextLocationSelection = createLocationSelection(profile.defaultLocationLabel);
      setLocationSelection(nextLocationSelection);
      setLocation(nextLocationSelection?.label || profile.defaultLocationLabel);
    }
  }, [initialLocation, location, profile?.defaultLocationLabel]);

  useEffect(() => {
    if (
      (!initialRadiusMiles || initialRadiusMiles === 5) &&
      radiusMiles === initialRadiusMiles &&
      profile?.preferredSearchRadius &&
      profile.preferredSearchRadius !== radiusMiles
    ) {
      setRadiusMiles(profile.preferredSearchRadius);
    }
  }, [initialRadiusMiles, profile?.preferredSearchRadius, radiusMiles]);

  const handleMedicationInputChange = (nextValue: string) => {
    setMedication(nextValue);
    setMedicationError(null);
    setStrengthError(null);

    if (
      medicationOption &&
      nextValue.trim().toLowerCase() !== medicationOption.label.trim().toLowerCase()
    ) {
      setMedicationOption(null);
      setSelectedStrength("");
      return;
    }

    if (
      !medicationOption &&
      selectedStrength &&
      nextValue.trim().toLowerCase() !== medication.trim().toLowerCase()
    ) {
      setSelectedStrength("");
    }
  };

  const handleLocationInputChange = (nextValue: string) => {
    setLocation(nextValue);
    setLocationError(null);

    if (
      locationSelection &&
      nextValue.trim().toLowerCase() !== locationSelection.label.trim().toLowerCase()
    ) {
      setLocationSelection(null);
    }
  };
  const medicationSupportText =
    medicationOption?.demoOnly
      ? `Simulated demo medication · ${medicationOption.simulatedUserCount || 0} seeded demo users`
      : Array.from(
          new Set(
            [medicationOption?.formulation, medicationOption?.dosageForm].filter(Boolean),
          ),
        ).join(" · ") || null;

  return (
    <div
      className={cn(
        "surface-panel rounded-[1.7rem] p-4 sm:p-[1.125rem] xl:p-5",
        compact && "rounded-[1.6rem] p-3.5 sm:p-4",
        className,
      )}
    >
      <form
        className={cn("space-y-2.5", compact && "space-y-2")}
        onSubmit={async (event) => {
          event.preventDefault();
          setIsResolvingSearch(true);
          const normalizedMedication = medication.trim();
          const normalizedLocation = location.trim();

          if (!normalizedMedication || !normalizedLocation) {
            setMedicationError(normalizedMedication ? null : "Choose a medication from the search results.");
            setLocationError(
              normalizedLocation ? null : "Enter a city, ZIP, address, pharmacy, or landmark.",
            );
            setIsResolvingSearch(false);
            return;
          }

          const [medicationResult, locationResult] = await Promise.allSettled([
            medicationOption
              ? Promise.resolve(medicationOption)
              : resolveMedicationOption(normalizedMedication),
            resolveLocationQuery({
              query: normalizedLocation,
              placeId: locationSelection?.placeId,
              sessionToken: locationSessionToken,
            }),
          ]);

          try {
            const resolvedMedication =
              medicationResult.status === "fulfilled" ? medicationResult.value : null;
            const resolvedLocation =
              locationResult.status === "fulfilled" ? locationResult.value : null;
            const canUseDirectLocationFallback =
              locationResult.status === "rejected" &&
              canFallbackToDirectLocationSearch(locationResult.reason);
            const resolvedStrength =
              selectedStrength ||
              resolvedMedication?.matchedStrength ||
              inferMatchedStrength(normalizedMedication, resolvedMedication?.strengths || []) ||
              (resolvedMedication?.strengths.length === 1 ? resolvedMedication.strengths[0].value : "");

            setMedicationError(
              medicationResult.status === "rejected"
                ? medicationResult.reason instanceof Error
                  ? medicationResult.reason.message
                  : "Unable to search medications right now."
                : resolvedMedication
                  ? null
                  : "Choose a medication from the search results.",
            );
            setStrengthError(
              resolvedMedication && resolvedMedication.strengths.length > 1 && !resolvedStrength
                ? "Choose a specific strength before searching."
                : null,
            );
            setLocationError(
              canUseDirectLocationFallback
                ? null
                : locationResult.status === "rejected"
                ? locationResult.reason instanceof Error
                  ? locationResult.reason.message
                  : "Unable to resolve that location right now."
                : resolvedLocation
                  ? null
                  : "Enter a real location to search nearby pharmacies.",
            );

            if (
              !resolvedMedication ||
              (!resolvedLocation && !canUseDirectLocationFallback) ||
              (resolvedMedication.strengths.length > 1 && !resolvedStrength)
            ) {
              return;
            }

            const nextLocationLabel = resolvedLocation?.display_label || normalizedLocation;
            const nextLocationPlaceId = resolvedLocation?.place_id || null;
            setMedicationOption(resolvedMedication);
            setMedication(resolvedMedication.label);
            setSelectedStrength(resolvedStrength);
            setLocationSelection(
              createLocationSelection(nextLocationLabel, nextLocationPlaceId),
            );
            setLocation(nextLocationLabel);
            setLocationSessionToken(createLocationSessionToken());
            startTransition(() => {
              router.push(
                buildResultsHref({
                  medication: buildMedicationQueryLabel(resolvedMedication, resolvedStrength),
                  location: nextLocationLabel,
                  locationPlaceId: nextLocationPlaceId,
                  radiusMiles,
                  sortBy,
                  onlyOpenNow,
                  action,
                }),
              );
            });
          } finally {
            setIsResolvingSearch(false);
          }
        }}
      >
        <div className="grid items-start gap-x-3.5 gap-y-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.24fr)_minmax(12rem,0.8fr)_minmax(0,1fr)]">
          <MedicationCombobox
            className="sm:col-span-2 lg:col-span-1"
            label="Medication"
            placeholder="Search medication"
            value={medication}
            selectedOptionId={medicationOption?.id || null}
            helperText={medicationSupportText}
            onValueChange={handleMedicationInputChange}
            onSelect={(option) => {
              setMedicationOption(option);
              setMedication(option.label);
              setSelectedStrength(
                option.matchedStrength || (option.strengths.length === 1 ? option.strengths[0].value : ""),
              );
              setMedicationError(null);
              setStrengthError(null);
            }}
            emptyMessage="No medication matches yet. Try a brand, generic, or strength."
            error={medicationError}
          />

          <MedicationStrengthField
            className="sm:col-span-1"
            option={medicationOption}
            value={selectedStrength}
            onChange={(nextValue) => {
              setSelectedStrength(nextValue);
              setStrengthError(null);
            }}
            error={strengthError}
            showWhenEmpty
            resolvedValue={!medicationOption ? selectedStrength : null}
            helperText={
              !medicationOption && selectedStrength
                ? "Selected presentation from the current search."
                : undefined
            }
          />

          <LocationCombobox
            className="sm:col-span-1"
            label="Location"
            placeholder="City, ZIP, or address"
            value={location}
            selectedPlaceId={locationSelection?.placeId || null}
            sessionToken={locationSessionToken}
            onValueChange={handleLocationInputChange}
            onSelect={(option) => {
              setLocationSelection(
                createLocationSelection(option.description, option.placeId),
              );
              setLocation(option.description);
              setLocationError(null);
            }}
            error={locationError}
          />
        </div>

        <div className="grid gap-x-3.5 gap-y-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,0.74fr)_minmax(0,0.92fr)_minmax(0,1fr)_auto] lg:items-end">
          <label className="search-field-stack">
            <span className="search-field-label">Radius</span>
            <select
              className="search-select-control"
              value={radiusMiles}
              onChange={(event) => setRadiusMiles(Number(event.target.value))}
            >
              <option value={2}>2 miles</option>
              <option value={5}>5 miles</option>
              <option value={10}>10 miles</option>
              <option value={25}>25 miles</option>
            </select>
          </label>

          <label className="search-field-stack">
            <span className="search-field-label">Sort</span>
            <select
              className="search-select-control"
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as "best_match" | "distance" | "rating")
              }
            >
              <option value="best_match">Best overall match</option>
              <option value="distance">Closest first</option>
              <option value="rating">Highest rating</option>
            </select>
          </label>

          <label className="search-field-stack sm:col-span-2 lg:col-span-1">
            <span className="search-field-label">Availability</span>
            <span className="search-toggle-control cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#156d95] focus:ring-[#156d95]"
                checked={onlyOpenNow}
                onChange={(event) => setOnlyOpenNow(event.target.checked)}
              />
              <span className="min-w-0">Open now only</span>
            </span>
          </label>
          <button
            type="submit"
            disabled={isPending || isResolvingSearch}
            className="action-button-primary relative z-40 order-6 min-h-[3.35rem] whitespace-nowrap px-5 text-sm disabled:cursor-wait disabled:opacity-70 sm:col-span-2 lg:order-none lg:col-span-1 lg:justify-self-end"
          >
            {isPending || isResolvingSearch ? "Loading…" : submitLabel}
          </button>
          <p className="order-5 max-w-[40rem] text-[0.78rem] leading-5 text-slate-500 sm:col-span-2 lg:order-none lg:col-span-3 lg:pr-4">
            Nearby pharmacies come from a live search. Stock still needs a direct call before pickup or transfer.
          </p>
        </div>
      </form>

      {showSamples ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {featuredSearches.map((search) => (
            <button
              key={search.id}
              type="button"
              className="flat-chip hover:border-[#156d95]/25 hover:text-[#156d95]"
              onClick={() =>
                startTransition(() => {
                  router.push(
                    buildResultsHref({
                      medication: search.medication,
                      location: search.location,
                      radiusMiles: 5,
                      sortBy: "best_match",
                      onlyOpenNow: false,
                      action,
                    }),
                  );
                })
              }
            >
              {search.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
