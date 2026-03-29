"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ControlledCombobox } from "@/components/search/controlled-combobox";
import { featuredSearches } from "@/lib/content";
import { useAuth } from "@/lib/auth/auth-context";
import {
  findSupportedOption,
  locationOptions,
  medicationOptions,
  resolveInitialOption,
  type SearchOption,
} from "@/lib/search-options";
import { cn } from "@/lib/utils";

type PharmacySearchFormProps = {
  initialMedication?: string;
  initialLocation?: string;
  initialRadiusMiles?: number;
  initialSortBy?: "best_match" | "distance" | "rating";
  initialOnlyOpenNow?: boolean;
  action?: string;
  compact?: boolean;
  submitLabel?: string;
  showSamples?: boolean;
  className?: string;
};

function buildResultsHref({
  medication,
  location,
  radiusMiles,
  sortBy,
  onlyOpenNow,
  action = "/patient/results",
}: {
  medication: string;
  location: string;
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

  return `${action}?${params.toString()}`;
}

export function PharmacySearchForm({
  initialMedication = "",
  initialLocation = "",
  initialRadiusMiles = 5,
  initialSortBy = "best_match",
  initialOnlyOpenNow = false,
  action = "/patient/results",
  compact = false,
  submitLabel = "Search live nearby pharmacies",
  showSamples = false,
  className,
}: PharmacySearchFormProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [medicationOption, setMedicationOption] = useState<SearchOption | null>(() =>
    resolveInitialOption(medicationOptions, initialMedication),
  );
  const [medication, setMedication] = useState(
    resolveInitialOption(medicationOptions, initialMedication)?.label || initialMedication,
  );
  const [locationOption, setLocationOption] = useState<SearchOption | null>(() =>
    resolveInitialOption(locationOptions, initialLocation),
  );
  const [location, setLocation] = useState(
    resolveInitialOption(locationOptions, initialLocation)?.label || initialLocation,
  );
  const [radiusMiles, setRadiusMiles] = useState(initialRadiusMiles);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [onlyOpenNow, setOnlyOpenNow] = useState(initialOnlyOpenNow);
  const [medicationError, setMedicationError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const nextMedicationOption = resolveInitialOption(medicationOptions, initialMedication);
    setMedicationOption(nextMedicationOption);
    setMedication(nextMedicationOption?.label || initialMedication);
  }, [initialMedication]);

  useEffect(() => {
    const nextLocationOption = resolveInitialOption(locationOptions, initialLocation);
    setLocationOption(nextLocationOption);
    setLocation(nextLocationOption?.label || initialLocation);
  }, [initialLocation]);

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
      const nextLocationOption = resolveInitialOption(locationOptions, profile.defaultLocationLabel);
      setLocationOption(nextLocationOption);
      setLocation(nextLocationOption?.label || profile.defaultLocationLabel);
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

    if (
      medicationOption &&
      nextValue.trim().toLowerCase() !== medicationOption.label.trim().toLowerCase()
    ) {
      setMedicationOption(null);
    }
  };

  const handleLocationInputChange = (nextValue: string) => {
    setLocation(nextValue);
    setLocationError(null);

    if (
      locationOption &&
      nextValue.trim().toLowerCase() !== locationOption.label.trim().toLowerCase()
    ) {
      setLocationOption(null);
    }
  };

  return (
    <div className={cn("surface-panel rounded-[2rem] p-5 sm:p-6", className)}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();

          const resolvedMedication =
            medicationOption || findSupportedOption(medicationOptions, medication);
          const resolvedLocation = locationOption || findSupportedOption(locationOptions, location);

          setMedicationError(
            resolvedMedication ? null : "Choose a supported medication from the list.",
          );
          setLocationError(
            resolvedLocation ? null : "Choose a supported city or ZIP-backed location.",
          );

          if (!resolvedMedication || !resolvedLocation) {
            return;
          }

          startTransition(() => {
            router.push(
              buildResultsHref({
                medication: resolvedMedication.value,
                location: resolvedLocation.value,
                radiusMiles,
                sortBy,
                onlyOpenNow,
                action,
              }),
            );
          });
        }}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <ControlledCombobox
            label="Medication"
            placeholder="Select a medication"
            options={medicationOptions}
            value={medication}
            selectedOptionId={medicationOption?.id || null}
            onValueChange={handleMedicationInputChange}
            onSelect={(option) => {
              setMedicationOption(option);
              setMedication(option.label);
              setMedicationError(null);
            }}
            emptyMessage="No supported medications match that search yet."
            error={medicationError}
          />

          <ControlledCombobox
            label="Location"
            placeholder="Select a city or ZIP-backed area"
            options={locationOptions}
            value={location}
            selectedOptionId={locationOption?.id || null}
            onValueChange={handleLocationInputChange}
            onSelect={(option) => {
              setLocationOption(option);
              setLocation(option.label);
              setLocationError(null);
            }}
            emptyMessage="No supported city or ZIP-backed locations match that search yet."
            error={locationError}
          />
        </div>

        <div
          className={cn(
            "grid gap-3",
            compact ? "sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_auto]" : "sm:grid-cols-[1fr_1fr_auto]",
          )}
        >
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Radius</span>
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

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Sort</span>
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

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Availability</span>
            <span className="search-toggle-control">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300 text-[#156d95] focus:ring-[#156d95]"
                checked={onlyOpenNow}
                onChange={(event) => setOnlyOpenNow(event.target.checked)}
              />
              Open now only
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-slate-600">
            Nearby pharmacies come from live Google Places results. Inventory still requires direct
            confirmation.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="template-button-primary disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? "Loading..." : submitLabel}
          </button>
        </div>
      </form>

      {showSamples ? (
        <div className="mt-5 flex flex-wrap gap-2">
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
