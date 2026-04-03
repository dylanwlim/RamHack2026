"use client";

import NextLink from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  LoaderCircle,
  MapPin,
  PhoneCall,
} from "lucide-react";
import { CrowdSignalCard } from "@/components/crowd-signal/crowd-signal-card";
import { getDemoCrowdSignalSummary } from "@/lib/crowd-signal/demo-signals";
import {
  createPharmaPathClient,
  type DrugIntelligenceResponse,
  type PharmacySearchResponse,
} from "@/lib/pharmapath-client";
import { useAuth } from "@/lib/auth/auth-context";
import {
  buildCrowdSignalMap,
  buildSignalKey,
} from "@/lib/crowd-signal/scoring";
import { PharmacySearchForm } from "@/components/search/pharmacy-search-form";
import {
  EmptyState,
  MetricPill,
  formatMiles,
} from "@/components/search/shared";
import {
  MedicationAccessSnapshotCard,
  MedicationContextDetails,
  selectMedicationMatch,
} from "@/components/search/shortage-intelligence-panel";

const client = createPharmaPathClient();

type PharmacyResult = PharmacySearchResponse["results"][number];
const pharmacyCardShellClass =
  "rounded-[1.4rem] border border-emerald-200/80 bg-white/96 shadow-[0_14px_32px_rgba(34,197,94,0.06)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-emerald-300/85 hover:shadow-[0_16px_36px_rgba(34,197,94,0.08)]";
const pharmacyActionButtonClass =
  "inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-[#156d95] transition hover:border-[#156d95]/30 hover:text-[#0f5d7d]";
const pharmacyActionButtonCompactClass =
  "inline-flex min-h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.88rem] font-medium text-[#156d95] transition hover:border-[#156d95]/30 hover:text-[#0f5d7d]";

function ResultDistanceChip({
  distanceMiles,
}: {
  distanceMiles: PharmacyResult["distance_miles"];
}) {
  return (
    <span className="flat-chip whitespace-nowrap">
      {formatMiles(distanceMiles)}
    </span>
  );
}

function PharmacyMapAction({
  href,
}: {
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={pharmacyActionButtonClass}
    >
      <ExternalLink className="h-4 w-4" />
      <span>View map</span>
    </a>
  );
}

function PharmacyActionRow({
  pharmacy,
  compact = false,
}: {
  pharmacy: PharmacyResult;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <PharmacyPhoneAction
            pharmacy={pharmacy}
            className={pharmacyActionButtonCompactClass}
          />
          {pharmacy.google_maps_url ? (
            <PharmacyMapActionCompact href={pharmacy.google_maps_url} />
          ) : null}
        </div>
        <p className="text-[0.78rem] leading-5 text-slate-500">
          Inventory still needs a direct call.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <PharmacyPhoneAction
          pharmacy={pharmacy}
          className={pharmacyActionButtonClass}
        />
        {pharmacy.google_maps_url ? (
          <PharmacyMapAction href={pharmacy.google_maps_url} />
        ) : null}
      </div>
      <div className="inline-flex items-center gap-2 text-sm text-slate-500">
        <PhoneCall className="h-4 w-4" />
        Inventory still needs a direct call.
      </div>
    </div>
  );
}

function PharmacyMapActionCompact({
  href,
}: {
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={pharmacyActionButtonCompactClass}
    >
      <ExternalLink className="h-4 w-4" />
      <span>View map</span>
    </a>
  );
}

function PharmacyAvailabilityMeta({
  result,
  compact = false,
}: {
  result: PharmacyResult;
  compact?: boolean;
}) {
  const statusLabel =
    result.hours_status_label ||
    (result.open_now === true
      ? "Open now"
      : result.open_now === false
        ? "Closed now"
        : "Hours unavailable");

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        compact ? "text-xs" : "text-sm"
      } text-slate-600`}
    >
      <span className="flat-chip">{statusLabel}</span>
      {result.hours_detail_label ? (
        <span className={compact ? "text-xs text-slate-500" : "text-sm text-slate-500"}>
          {result.hours_detail_label}
        </span>
      ) : null}
      {result.rating ? (
        <span className="flat-chip">Rating {result.rating.toFixed(1)}</span>
      ) : null}
      <span className="flat-chip">{result.review_label}</span>
    </div>
  );
}

function buildPrescriberReviewHref(
  query: string,
  location: string,
  matchId: string,
) {
  return `/prescriber?${new URLSearchParams({
    query,
    id: matchId,
    location,
  }).toString()}`;
}

function PrescriberReviewCard({
  query,
  location,
  matchId,
}: {
  query: string;
  location: string;
  matchId: string;
}) {
  return (
    <div className="surface-panel h-full rounded-[1.55rem] p-4 sm:p-5">
      <span className="eyebrow-label">Next step</span>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Move into the prescriber-facing view if you want the same medication
        family framed around shortage planning, formulation spread, and
        manufacturer coverage.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <NextLink
          href={buildPrescriberReviewHref(query, location, matchId)}
          className="action-button-dark text-sm"
        >
          Review prescriber view
        </NextLink>
      </div>
    </div>
  );
}

function PharmacyPhoneAction({
  pharmacy,
  className,
}: {
  pharmacy: PharmacyResult;
  className: string;
}) {
  if (!pharmacy.phone_number) {
    return null;
  }

  const label = pharmacy.phone_link ? `Call ${pharmacy.phone_number}` : `Phone ${pharmacy.phone_number}`;

  if (pharmacy.phone_link) {
    return (
      <a
        href={pharmacy.phone_link}
        aria-label={`Call ${pharmacy.name} at ${pharmacy.phone_number}`}
        className={className}
      >
        <PhoneCall className="h-4 w-4" />
        <span>{label}</span>
      </a>
    );
  }

  return (
    <div className={className}>
      <PhoneCall className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}

function MedicationContextError({ message }: { message: string }) {
  return (
    <div className="surface-panel rounded-[1.55rem] border-rose-200 bg-rose-50 p-4 text-rose-700 sm:p-5">
      <div className="text-sm font-medium uppercase tracking-[0.18em]">
        Medication context unavailable
      </div>
      <p className="mt-2 text-[0.98rem] leading-7">{message}</p>
    </div>
  );
}

export function PatientResultsClient({
  initialQuery = "",
  initialLocation = "",
  initialLocationPlaceId = "",
  initialRadiusMiles,
  initialSortBy = "best_match",
  initialOnlyOpenNow,
}: {
  initialQuery?: string;
  initialLocation?: string;
  initialLocationPlaceId?: string;
  initialRadiusMiles?: string;
  initialSortBy?: "best_match" | "distance" | "rating";
  initialOnlyOpenNow?: string;
}) {
  const query = initialQuery.trim();
  const location = initialLocation.trim();
  const locationPlaceId = initialLocationPlaceId.trim();
  const radiusMiles = Number(initialRadiusMiles || 5);
  const sortBy = initialSortBy || "best_match";
  const onlyOpenNow = initialOnlyOpenNow === "true";
  const { user } = useAuth();
  const lastSavedRecentSearchKeyRef = useRef<string | null>(null);
  const hasSearchInput = Boolean(query && location);

  const [pharmacyData, setPharmacyData] =
    useState<PharmacySearchResponse | null>(null);
  const [drugData, setDrugData] = useState<DrugIntelligenceResponse | null>(
    null,
  );
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);
  const [drugError, setDrugError] = useState<string | null>(null);
  const [crowdSignals, setCrowdSignals] = useState<
    Record<string, ReturnType<typeof buildCrowdSignalMap>[string]>
  >({});
  const [crowdReady, setCrowdReady] = useState(false);
  const [isLoading, setIsLoading] = useState(hasSearchInput);
  const [showAll, setShowAll] = useState(false);

  const featuredMatch = useMemo(
    () =>
      selectMedicationMatch(drugData?.matches, {
        featuredId: drugData?.featured_match_id,
      }),
    [drugData],
  );

  useEffect(() => {
    setShowAll(false);

    if (!query || !location) {
      setPharmacyData(null);
      setDrugData(null);
      setPharmacyError(null);
      setDrugError(null);
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    setIsLoading(true);

    Promise.allSettled([
      client.searchPharmacies({
        medication: query,
        location,
        locationPlaceId: locationPlaceId || undefined,
        radiusMiles,
        sortBy,
        onlyOpenNow,
      }, { signal: abortController.signal }),
      client.getDrugIntelligence(query, { signal: abortController.signal }),
    ]).then(([pharmacyResult, drugResult]) => {
      if (abortController.signal.aborted) {
        return;
      }

      if (pharmacyResult.status === "fulfilled") {
        setPharmacyData(pharmacyResult.value);
        setPharmacyError(null);
      } else {
        setPharmacyData(null);
        setPharmacyError(
          pharmacyResult.reason?.message || "Unable to load nearby pharmacies.",
        );
      }

      if (drugResult.status === "fulfilled") {
        setDrugData(drugResult.value);
        setDrugError(null);
      } else {
        setDrugData(null);
        setDrugError(
          drugResult.reason?.message ||
            "Unable to load medication intelligence.",
        );
      }

      setIsLoading(false);
    });

    return () => {
      abortController.abort();
    };
  }, [query, location, locationPlaceId, radiusMiles, sortBy, onlyOpenNow]);

  useEffect(() => {
    if (!query) {
      setCrowdSignals({});
      setCrowdReady(true);
      return;
    }

    setCrowdReady(false);
    let cancelled = false;
    let unsubscribe: () => void = () => undefined;

    void import("@/lib/crowd-signal/firestore")
      .then(({ subscribeToCrowdReportsForMedication }) => {
        if (cancelled) {
          return;
        }

        unsubscribe = subscribeToCrowdReportsForMedication(query, (reports) => {
          setCrowdSignals(buildCrowdSignalMap(reports));
          setCrowdReady(true);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCrowdSignals({});
          setCrowdReady(true);
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [query]);

  useEffect(() => {
    if (!user || !query || !location) {
      return;
    }

    const recentSearchKey = [
      user.uid,
      query.trim().toLowerCase(),
      location.trim().toLowerCase(),
      String(radiusMiles),
    ].join("::");

    if (lastSavedRecentSearchKeyRef.current === recentSearchKey) {
      return;
    }

    lastSavedRecentSearchKeyRef.current = recentSearchKey;

    void import("@/lib/profile/profile-service")
      .then(({ saveRecentSearch }) =>
        saveRecentSearch(user.uid, {
          medication: query,
          location,
          radiusMiles,
        }),
      )
      .catch(() => {
        if (lastSavedRecentSearchKeyRef.current === recentSearchKey) {
          lastSavedRecentSearchKeyRef.current = null;
        }
      });
  }, [location, query, radiusMiles, user]);

  const extraResults = pharmacyData?.results.slice(1) || [];
  const visibleExtras = showAll ? extraResults : extraResults.slice(0, 4);
  const isDemoMedication = Boolean(
    pharmacyData?.medication_profile.demo_only ||
    featuredMatch?.demo_context?.demo_only ||
    drugData?.data_source === "demo",
  );
  const resolvedMedicationLabel =
    pharmacyData?.medication_profile.medication_label?.trim() ||
    featuredMatch?.demo_context?.selected_label?.trim() ||
    query;
  const resolvedMedicationStrength =
    pharmacyData?.medication_profile.selected_strength?.trim() ||
    featuredMatch?.demo_context?.selected_strength?.trim() ||
    "";

  function resolveCrowdSignalSummary(
    result: PharmacySearchResponse["results"][number],
    demoIndex = 0,
  ) {
    const lookupKey = buildSignalKey({
      medicationQuery: query,
      placeId: result.place_id,
      pharmacyName: result.name,
      pharmacyAddress: result.address,
    });

    return isDemoMedication
      ? getDemoCrowdSignalSummary(lookupKey, demoIndex)
      : crowdSignals[lookupKey];
  }

  return (
    <>
      <section className="px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        <div className="site-shell grid gap-7 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-start xl:gap-9">
          <div className="max-w-[28rem] pt-1 sm:max-w-[30rem]">
            <span className="eyebrow-label">Pharmacy Results</span>
            <h1 className="mt-5 max-w-[25rem] text-[2.45rem] leading-[0.97] tracking-tight text-balance text-slate-950 sm:text-[2.85rem] xl:text-[3.05rem]">
              Nearby pharmacies first. Medication context on the right.
            </h1>
            <p className="mt-4 max-w-[27rem] text-[1rem] leading-7 text-slate-600 sm:text-[1.06rem]">
              {isDemoMedication
                ? "This search keeps the live nearby list and the clearly labeled demo medication profile together, while staying explicit that the medication context is simulated."
                : "This search keeps the live nearby list and medication access context together without blurring them into a claim of verified shelf inventory."}
            </p>
          </div>

          <PharmacySearchForm
            className="justify-self-stretch"
            initialMedication={resolvedMedicationLabel}
            initialLocation={location}
            initialLocationPlaceId={locationPlaceId || undefined}
            initialRadiusMiles={radiusMiles}
            initialSortBy={sortBy}
            initialOnlyOpenNow={onlyOpenNow}
            initialSelectedStrength={resolvedMedicationStrength}
            compact
            submitLabel="Refresh nearby search"
          />
        </div>
      </section>

      <section className="px-4 pb-18 sm:px-6 lg:px-8">
        <div className="site-shell space-y-6">
          {!query || !location ? (
            <EmptyState
              eyebrow="Ready when you are"
              title="Enter a medication and a location to load Pharmacy Finder."
              body="PharmaPath combines a live nearby pharmacy lookup with medication access context without claiming any pharmacy has the medication confirmed on the shelf."
            />
          ) : isLoading ? (
            <div className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.86fr)]">
                <div className="surface-panel flex min-h-[22rem] items-center justify-center rounded-[1.85rem]">
                  <div className="flex items-center gap-3 text-slate-500">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Loading nearby options and medication context…
                  </div>
                </div>
                <div className="surface-panel min-h-[22rem] rounded-[1.85rem] p-5" />
              </div>
              <div className="surface-panel min-h-[12rem] rounded-[1.85rem] p-5" />
            </div>
          ) : (
            <>
              {isDemoMedication ? (
                <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50/85 px-4 py-3.5 text-sm leading-6 text-amber-950">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow-label text-amber-700">
                      Demo medication
                    </span>
                    <span className="rounded-full border border-amber-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                      Simulated
                    </span>
                  </div>
                  <p className="mt-1.5">
                    {pharmacyData?.medication_profile.demo_note ||
                      featuredMatch?.demo_context?.note}
                  </p>
                  <p className="mt-1 text-amber-900/80">
                    {pharmacyData?.medication_profile.simulated_user_count ||
                      featuredMatch?.demo_context?.simulated_user_count ||
                      0}{" "}
                    seeded demo users are included for this fictional medication
                    variant. Live pharmacy results stay real, and
                    pharmacy-specific crowd reports remain a separate layer.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.86fr)] xl:items-start">
                <div className="space-y-5">
                  <div className="surface-panel rounded-[1.85rem] p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="eyebrow-label">
                          Live nearby pharmacies
                        </span>
                        <h2 className="mt-3 text-[1.8rem] tracking-tight text-balance text-slate-950 sm:text-[2rem]">
                          {pharmacyData?.location.display_label ||
                            pharmacyData?.location.formatted_address ||
                            location}
                        </h2>
                      </div>
                      {pharmacyData ? (
                        <div className="grid w-full grid-cols-3 gap-2.5 sm:w-auto sm:min-w-[18rem]">
                          <MetricPill
                            label="Results"
                            value={String(pharmacyData.counts.total)}
                          />
                          <MetricPill
                            label="Open now"
                            value={String(pharmacyData.counts.open_now)}
                          />
                          <MetricPill
                            label="Hours unknown"
                            value={String(pharmacyData.counts.hours_unknown)}
                          />
                        </div>
                      ) : null}
                    </div>

                    {pharmacyError ? (
                      <div className="mt-5 rounded-[1.3rem] border border-rose-200 bg-rose-50 p-4 text-rose-700">
                        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em]">
                          <AlertCircle className="h-4 w-4" />
                          Nearby lookup unavailable
                        </div>
                        <p className="mt-2 text-[0.98rem] leading-7">
                          {pharmacyError}
                        </p>
                      </div>
                    ) : pharmacyData?.degraded_reason ? (
                      <div className="mt-5 rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4 text-amber-800">
                        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em]">
                          <AlertCircle className="h-4 w-4" />
                          Live nearby search limited
                        </div>
                        <p className="mt-2 text-[0.98rem] leading-7">
                          {pharmacyData.degraded_reason}
                        </p>
                      </div>
                    ) : pharmacyData?.recommended ? (
                      <div className="mt-5">
                        <div
                          className={`${pharmacyCardShellClass} bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(244,251,247,0.96)_100%)] p-4 sm:p-5`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                                Recommended first call
                              </div>
                              <h3 className="mt-2 text-[1.4rem] tracking-tight text-slate-950 sm:text-[1.55rem]">
                                {pharmacyData.recommended.name}
                              </h3>
                              <p className="mt-1.5 text-sm leading-6 text-slate-600">
                                {pharmacyData.recommended.address}
                              </p>
                            </div>
                            <ResultDistanceChip
                              distanceMiles={
                                pharmacyData.recommended.distance_miles
                              }
                            />
                          </div>

                          <div className="mt-3">
                            <PharmacyAvailabilityMeta
                              result={pharmacyData.recommended}
                            />
                          </div>

                          <p className="mt-3 line-clamp-2 text-[0.96rem] leading-6 text-slate-700">
                            {pharmacyData.recommended.match_reason}
                          </p>

                          <div className="mt-3">
                            <CrowdSignalCard
                              medicationQuery={query}
                              medicationContext={
                                pharmacyData?.medication_profile
                              }
                              pharmacy={{
                                name: pharmacyData.recommended.name,
                                address: pharmacyData.recommended.address,
                                placeId: pharmacyData.recommended.place_id,
                                googleMapsUrl:
                                  pharmacyData.recommended.google_maps_url,
                              }}
                              summary={resolveCrowdSignalSummary(
                                pharmacyData.recommended,
                                0,
                              )}
                            />
                          </div>

                          <PharmacyActionRow pharmacy={pharmacyData.recommended} />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-[1.3rem] border border-slate-200 bg-white p-4 text-slate-600">
                        {pharmacyData?.degraded_reason
                          ? "Live nearby pharmacy results are unavailable right now. Medication context is still available below."
                          : "No nearby pharmacy results surfaced for this search. Try a broader location or a larger radius."}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {drugError ? (
                    <MedicationContextError message={drugError} />
                  ) : featuredMatch ? (
                    <MedicationAccessSnapshotCard
                      match={featuredMatch}
                      dataFreshness={drugData!.data_freshness}
                      variant="patient"
                      selectedMedicationLabel={resolvedMedicationLabel}
                      selectedStrength={resolvedMedicationStrength}
                    />
                  ) : (
                    <EmptyState
                      eyebrow="No clear match"
                      title={`No medication context matched "${query}".`}
                      body="No active shortage or recall context matched this medication. Try simplifying the medication name."
                    />
                  )}
                </div>
              </div>

              {featuredMatch && !drugError ? (
                <div className="surface-panel rounded-[1.85rem] p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="eyebrow-label">Medication context</span>
                      <h3 className="mt-3 text-[1.24rem] tracking-tight text-slate-950">
                        What to carry into the first call.
                      </h3>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <MedicationContextDetails
                      match={featuredMatch}
                      dataFreshness={drugData!.data_freshness}
                      variant="patient"
                      selectedMedicationLabel={resolvedMedicationLabel}
                      selectedStrength={resolvedMedicationStrength}
                    />
                    <PrescriberReviewCard
                      query={query}
                      location={location}
                      matchId={featuredMatch.id}
                    />
                  </div>
                </div>
              ) : null}

              {visibleExtras.length ? (
                <div className="surface-panel rounded-[1.85rem] p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="eyebrow-label">Other nearby options</span>
                      <h3 className="mt-3 text-[1.3rem] tracking-tight text-slate-950">
                        More pharmacies worth calling next.
                      </h3>
                    </div>
                    {extraResults.length > 4 ? (
                      <button
                        type="button"
                        className="text-sm text-[#156d95]"
                        onClick={() => setShowAll((value) => !value)}
                      >
                        {showAll ? "Show fewer" : `Show ${extraResults.length - 4} more`}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    {visibleExtras.map((result, resultIndex) => (
                      <div
                        key={`${result.name}-${result.address}`}
                        className={`${pharmacyCardShellClass} p-3.5`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[1.12rem] tracking-tight text-slate-900">
                              {result.name}
                            </div>
                            <div className="mt-1 text-sm leading-5 text-slate-500">
                              {result.address}
                            </div>
                          </div>
                          <ResultDistanceChip distanceMiles={result.distance_miles} />
                        </div>

                        <div className="mt-3">
                          <PharmacyAvailabilityMeta result={result} compact />
                        </div>

                        <p className="mt-2.5 line-clamp-2 text-[0.88rem] leading-5 text-slate-600">
                          {result.match_reason}
                        </p>

                        <div className="mt-2.5">
                          <CrowdSignalCard
                            medicationQuery={query}
                            medicationContext={pharmacyData?.medication_profile}
                            pharmacy={{
                              name: result.name,
                              address: result.address,
                              placeId: result.place_id,
                              googleMapsUrl: result.google_maps_url,
                            }}
                            summary={resolveCrowdSignalSummary(result, resultIndex + 1)}
                            compact
                          />
                        </div>

                        <PharmacyActionRow pharmacy={result} compact />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {pharmacyData ? (
                <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3.5 text-sm leading-6 text-slate-600">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <MapPin className="h-4 w-4 text-[#156d95]" />
                    {pharmacyData.disclaimer}
                  </div>
                  <p className="mt-1.5 text-[0.92rem] leading-6">
                    {pharmacyData.guidance.demo_boundary} Community reports sit
                    on top of the live nearby list as a separate, weighted layer
                    rather than as a claim of verified shelf inventory.
                    {pharmacyData.medication_profile.demo_only
                      ? " This medication profile is simulated for the demo and is intentionally separated from the main medication reference flow."
                      : ""}
                  </p>
                  {!crowdReady ? (
                    <div className="mt-2.5 flex items-center gap-2 text-slate-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading crowd signal...
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </>
  );
}
