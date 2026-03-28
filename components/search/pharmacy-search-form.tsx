"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { featuredSearches } from "@/lib/content";
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
  const [isPending, startTransition] = useTransition();
  const [medication, setMedication] = useState(initialMedication);
  const [location, setLocation] = useState(initialLocation);
  const [radiusMiles, setRadiusMiles] = useState(initialRadiusMiles);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [onlyOpenNow, setOnlyOpenNow] = useState(initialOnlyOpenNow);

  return (
    <div className={cn("surface-panel rounded-[2rem] p-5 sm:p-6", className)}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(() => {
            router.push(
              buildResultsHref({
                medication,
                location,
                radiusMiles,
                sortBy,
                onlyOpenNow,
                action,
              }),
            );
          });
        }}
      >
        <div className={cn("grid gap-3", compact ? "lg:grid-cols-2" : "lg:grid-cols-2")}>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Medication</span>
            <input
              className="h-14 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[#156d95] focus:ring-4 focus:ring-[#156d95]/10"
              placeholder="Adderall XR 20 mg"
              value={medication}
              onChange={(event) => setMedication(event.target.value)}
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Location</span>
            <input
              className="h-14 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[#156d95] focus:ring-4 focus:ring-[#156d95]/10"
              placeholder="Brooklyn, NY"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              required
            />
          </label>
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
              className="h-12 w-full rounded-[1.05rem] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#156d95] focus:ring-4 focus:ring-[#156d95]/10"
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
              className="h-12 w-full rounded-[1.05rem] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#156d95] focus:ring-4 focus:ring-[#156d95]/10"
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

          <label className="flex items-center gap-3 rounded-[1.05rem] border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-[#156d95] focus:ring-[#156d95]"
              checked={onlyOpenNow}
              onChange={(event) => setOnlyOpenNow(event.target.checked)}
            />
            Open now only
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
            className="rounded-full bg-[#156d95] px-[18px] py-[15px] text-sm font-medium leading-4 text-white transition-all duration-200 hover:rounded-2xl hover:bg-[#12597a] disabled:cursor-wait disabled:opacity-70"
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
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-[#156d95] hover:text-[#156d95]"
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
