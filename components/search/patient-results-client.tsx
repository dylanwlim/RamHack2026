"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, LoaderCircle, MapPin, PhoneCall } from "lucide-react";
import {
  createPharmaPathClient,
  type DrugIntelligenceResponse,
  type PharmacySearchResponse,
} from "@/lib/pharmapath-client";
import { PharmacySearchForm } from "@/components/search/pharmacy-search-form";
import {
  CalloutList,
  EmptyState,
  MetricPill,
  formatDisplayDate,
  formatMiles,
} from "@/components/search/shared";

const client = createPharmaPathClient();

type Match = DrugIntelligenceResponse["matches"][number];

function shortageSeverityBadge(activeCount: number) {
  if (activeCount === 0) {
    return { label: "No active shortage", className: "bg-emerald-100 text-emerald-800" };
  }
  if (activeCount === 1) {
    return { label: "1 active shortage", className: "bg-amber-100 text-amber-800" };
  }
  return { label: `${activeCount} active shortages`, className: "bg-rose-100 text-rose-800" };
}

function ShortagePanel({
  match,
  drugData,
}: {
  match: Match;
  drugData: DrugIntelligenceResponse;
  query: string;
  location: string;
}) {
  const activeShortages = match.evidence.shortages.items.filter(
    (s) => (s.normalizedStatus ?? s.status?.toLowerCase()) === "active",
  );
  const hasShortage = activeShortages.length > 0;
  const hasRecalls = match.evidence.recalls.recent_count > 0;
  const badge = shortageSeverityBadge(activeShortages.length);

  return (
    <>
      {/* Header card */}
      <div className="surface-panel rounded-[2rem] p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="eyebrow-label">FDA Shortage Data</span>
            <h2 className="mt-4 text-2xl tracking-tight text-slate-950">{match.display_name}</h2>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <MetricPill label="Active shortages" value={String(match.evidence.shortages.active_count)} />
          <MetricPill label="Recent recalls" value={String(match.evidence.recalls.recent_count)} />
          <MetricPill label="Manufacturers" value={String(match.manufacturers.length)} />
          <MetricPill label="FDA listings" value={String(match.active_listing_count)} />
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Shortages updated {formatDisplayDate(drugData.data_freshness.shortages_last_updated)} ·
          Recalls {formatDisplayDate(drugData.data_freshness.recalls_last_updated)}
        </p>
      </div>

      {/* What FDA data shows */}
      <div className="surface-panel rounded-[2rem] p-6">
        <span className="eyebrow-label">What the FDA data shows</span>
        <CalloutList className="mt-5" items={match.patient_view.what_we_know} />
      </div>

      {/* Active shortage entries */}
      {hasShortage ? (
        <div className="surface-panel rounded-[2rem] p-6">
          <span className="eyebrow-label">Active shortage entries</span>
          <div className="mt-5 space-y-3">
            {activeShortages.slice(0, 5).map((s, i) => (
              <div key={i} className="rounded-[1.2rem] border border-rose-100 bg-rose-50 p-4">
                {s.presentation ? (
                  <div className="text-sm font-medium text-slate-900">{s.presentation}</div>
                ) : null}
                {s.companyName ? (
                  <div className="mt-1 text-sm text-slate-500">{s.companyName}</div>
                ) : null}
                {s.shortageReason ? (
                  <div className="mt-1 text-sm text-slate-600">
                    <span className="font-medium">Reason:</span> {s.shortageReason}
                  </div>
                ) : null}
                {s.availability ? (
                  <div className="mt-1 text-sm text-slate-600">
                    <span className="font-medium">Availability:</span> {s.availability}
                  </div>
                ) : null}
                {s.updateLabel ? (
                  <div className="mt-1 text-xs text-slate-400">Last updated {s.updateLabel}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="surface-panel rounded-[2rem] p-6">
          <span className="eyebrow-label">Shortage status</span>
          <p className="mt-4 text-base leading-7 text-slate-600">
            No active shortage entries found in the FDA database for this medication family.
          </p>
        </div>
      )}

      {/* Key supply insights */}
      {match.patient_view.what_may_make_it_harder?.length ? (
        <div className="surface-panel rounded-[2rem] p-6">
          <span className="eyebrow-label">Key supply insights</span>
          <CalloutList className="mt-5" items={match.patient_view.what_may_make_it_harder} />
        </div>
      ) : null}

      {/* Questions to ask */}
      <div className="surface-panel rounded-[2rem] p-6">
        <span className="eyebrow-label">Questions to ask your pharmacist</span>
        <CalloutList className="mt-5" items={match.patient_view.questions_to_ask} />
      </div>

      {/* Recent recalls (only if present) */}
      {hasRecalls ? (
        <div className="surface-panel rounded-[2rem] p-6">
          <span className="eyebrow-label">Recent recall activity</span>
          <div className="mt-5 space-y-3">
            {match.evidence.recalls.items.slice(0, 3).map((r, i) => (
              <div key={i} className="rounded-[1.2rem] border border-amber-100 bg-amber-50 p-4">
                {r.productDescription ? (
                  <div className="text-sm font-medium text-slate-900">{r.productDescription}</div>
                ) : null}
                {r.recallingFirm ? (
                  <div className="mt-1 text-sm text-slate-500">{r.recallingFirm}</div>
                ) : null}
                {r.reason ? (
                  <div className="mt-1 text-sm text-slate-600">{r.reason}</div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  {r.classification ? <span className="rounded bg-amber-200 px-1.5 py-0.5 font-medium">Class {r.classification}</span> : null}
                  {r.reportDateLabel ? <span>{r.reportDateLabel}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-xs leading-6 text-slate-500">
        Data sourced from <strong>FDA openFDA Drug Shortages &amp; Enforcement APIs</strong>. Updated daily.
        For informational purposes only — confirm availability with your pharmacist.
      </div>
    </>
  );
}

export function PatientResultsClient() {
  const searchParams = useSearchParams();
  const query = searchParams.get("query")?.trim() || "";
  const location = searchParams.get("location")?.trim() || "";
  const radiusMiles = Number(searchParams.get("radiusMiles") || 5);
  const sortBy = (searchParams.get("sortBy") || "best_match") as "best_match" | "distance" | "rating";
  const onlyOpenNow = searchParams.get("onlyOpenNow") === "true";

  const [pharmacyData, setPharmacyData] = useState<PharmacySearchResponse | null>(null);
  const [drugData, setDrugData] = useState<DrugIntelligenceResponse | null>(null);
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);
  const [drugError, setDrugError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const featuredMatch = useMemo(() => {
    if (!drugData?.matches?.length) {
      return null;
    }

    return drugData.matches[0];
  }, [drugData]);

  useEffect(() => {
    setShowAll(false);

    if (!query || !location) {
      setPharmacyData(null);
      setDrugData(null);
      setPharmacyError(null);
      setDrugError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.allSettled([
      client.searchPharmacies({
        medication: query,
        location,
        radiusMiles,
        sortBy,
        onlyOpenNow,
      }),
      client.getDrugIntelligence(query),
    ]).then(([pharmacyResult, drugResult]) => {
      if (cancelled) {
        return;
      }

      if (pharmacyResult.status === "fulfilled") {
        setPharmacyData(pharmacyResult.value);
        setPharmacyError(null);
      } else {
        setPharmacyData(null);
        setPharmacyError(pharmacyResult.reason?.message || "Unable to load nearby pharmacies.");
      }

      if (drugResult.status === "fulfilled") {
        setDrugData(drugResult.value);
        setDrugError(null);
      } else {
        setDrugData(null);
        setDrugError(drugResult.reason?.message || "Unable to load medication intelligence.");
      }

      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [query, location, radiusMiles, sortBy, onlyOpenNow]);

  const extraResults = pharmacyData?.results.slice(1) || [];
  const visibleExtras = showAll ? extraResults : extraResults.slice(0, 4);

  return (
    <>
      <section className="px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <div className="site-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <span className="eyebrow-label">Patient results</span>
            <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.4rem]">
              Nearby pharmacies on the left. Medication signal on the right.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              This page keeps the live nearby lookup and the FDA-derived medication signal together,
              while staying explicit that they answer different questions.
            </p>
          </div>

          <PharmacySearchForm
            initialMedication={query}
            initialLocation={location}
            initialRadiusMiles={radiusMiles}
            initialSortBy={sortBy}
            initialOnlyOpenNow={onlyOpenNow}
            compact
            submitLabel="Refresh nearby search"
          />
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="site-shell space-y-6">
          {!query || !location ? (
            <EmptyState
              eyebrow="Ready when you are"
              title="Enter both a medication and a location to load the live patient view."
              body="PharmaPath will combine a live nearby pharmacy lookup with FDA-based access context, without claiming any pharmacy has the medication confirmed on the shelf."
            />
          ) : isLoading ? (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="surface-panel flex min-h-[28rem] items-center justify-center rounded-[2rem]">
                <div className="flex items-center gap-3 text-slate-500">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Loading nearby search and medication signal...
                </div>
              </div>
              <div className="surface-panel min-h-[28rem] rounded-[2rem] p-6" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <div className="surface-panel rounded-[2rem] p-6 sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="eyebrow-label">Live nearby pharmacies</span>
                      <h2 className="mt-4 text-2xl tracking-tight text-slate-950">
                        {pharmacyData?.location.formatted_address || location}
                      </h2>
                    </div>
                    {pharmacyData ? (
                      <div className="grid grid-cols-3 gap-3">
                        <MetricPill label="Results" value={String(pharmacyData.counts.total)} />
                        <MetricPill label="Open now" value={String(pharmacyData.counts.open_now)} />
                        <MetricPill
                          label="Hours unknown"
                          value={String(pharmacyData.counts.hours_unknown)}
                        />
                      </div>
                    ) : null}
                  </div>

                  {pharmacyError ? (
                    <div className="mt-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 text-rose-700">
                      <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em]">
                        <AlertCircle className="h-4 w-4" />
                        Nearby lookup unavailable
                      </div>
                      <p className="mt-3 text-base leading-7">{pharmacyError}</p>
                    </div>
                  ) : pharmacyData?.recommended ? (
                    <div className="mt-6 space-y-5">
                      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                              Recommended first call
                            </div>
                            <h3 className="mt-2 text-2xl tracking-tight text-slate-950">
                              {pharmacyData.recommended.name}
                            </h3>
                            <p className="mt-2 text-base leading-7 text-slate-600">
                              {pharmacyData.recommended.address}
                            </p>
                          </div>
                          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {formatMiles(pharmacyData.recommended.distance_miles)}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-600">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                            {pharmacyData.recommended.open_now === true
                              ? "Open now"
                              : pharmacyData.recommended.open_now === false
                                ? "Closed now"
                                : "Hours unavailable"}
                          </span>
                          {pharmacyData.recommended.rating ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                              Rating {pharmacyData.recommended.rating.toFixed(1)}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                            {pharmacyData.recommended.review_label}
                          </span>
                        </div>

                        <p className="mt-5 text-base leading-7 text-slate-700">
                          {pharmacyData.recommended.match_reason}
                        </p>

                        <div className="mt-5 rounded-[1.4rem] border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
                          <div className="font-medium">Suggested question</div>
                          <p className="mt-2">{pharmacyData.recommended.next_step}</p>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          {pharmacyData.recommended.google_maps_url ? (
                            <a
                              href={pharmacyData.recommended.google_maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded-full bg-slate-950 px-[18px] py-[15px] text-sm font-medium leading-4 text-white transition-all duration-200 hover:rounded-2xl"
                            >
                              Open in Google Maps
                            </a>
                          ) : null}
                          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                            <PhoneCall className="h-4 w-4" />
                            Inventory still needs a direct call.
                          </div>
                        </div>
                      </div>

                      {visibleExtras.length ? (
                        <div className="surface-panel rounded-[1.8rem] p-5">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-xl tracking-tight text-slate-950">Other nearby options</h3>
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
                          <div className="mt-4 space-y-3">
                            {visibleExtras.map((result) => (
                              <div
                                key={`${result.name}-${result.address}`}
                                className="rounded-[1.4rem] border border-slate-200 bg-white p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-lg tracking-tight text-slate-900">{result.name}</div>
                                    <div className="mt-1 text-sm text-slate-500">{result.address}</div>
                                  </div>
                                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                    {formatMiles(result.distance_miles)}
                                  </div>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-600">{result.match_reason}</p>
                                {result.google_maps_url ? (
                                  <a
                                    href={result.google_maps_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-flex items-center gap-2 text-sm text-[#156d95]"
                                  >
                                    View map
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-sm leading-6 text-slate-600">
                        <div className="flex items-center gap-2 font-medium text-slate-900">
                          <MapPin className="h-4 w-4 text-[#156d95]" />
                          {pharmacyData.disclaimer}
                        </div>
                        <p className="mt-2">{pharmacyData.guidance.demo_boundary}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-slate-600">
                      No nearby pharmacy results surfaced for this search. Try a broader location or
                      a larger radius.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {drugError ? (
                  <div className="surface-panel rounded-[2rem] border-rose-200 bg-rose-50 p-6 text-rose-700">
                    <div className="text-sm font-medium uppercase tracking-[0.18em]">
                      Shortage data unavailable
                    </div>
                    <p className="mt-3 text-base leading-7">{drugError}</p>
                  </div>
                ) : featuredMatch ? (
                  <ShortagePanel match={featuredMatch} drugData={drugData!} query={query} location={location} />
                ) : (
                  <EmptyState
                    eyebrow="No FDA match"
                    title={`No shortage data found for "${query}".`}
                    body="No active shortage records matched this medication in the FDA database. Try simplifying the medication name."
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
