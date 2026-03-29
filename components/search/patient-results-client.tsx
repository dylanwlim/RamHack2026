"use client";

import Link from "next/link";
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
  SignalBadge,
  formatDisplayDate,
  formatMiles,
} from "@/components/search/shared";

const client = createPharmaPathClient();

function buildFreshnessLine(payload: DrugIntelligenceResponse) {
  const entries = [
    payload.data_freshness.ndc_last_updated
      ? `Listings ${formatDisplayDate(payload.data_freshness.ndc_last_updated)}`
      : "",
    payload.data_freshness.shortages_last_updated
      ? `Shortages ${formatDisplayDate(payload.data_freshness.shortages_last_updated)}`
      : "",
    payload.data_freshness.recalls_last_updated
      ? `Recalls ${formatDisplayDate(payload.data_freshness.recalls_last_updated)}`
      : "",
  ].filter(Boolean);

  return entries.length ? entries.join(" · ") : "FDA freshness unavailable for this request.";
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
                          <div className="flat-chip">
                            {formatMiles(pharmacyData.recommended.distance_miles)}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-600">
                          <span className="flat-chip">
                            {pharmacyData.recommended.open_now === true
                              ? "Open now"
                              : pharmacyData.recommended.open_now === false
                                ? "Closed now"
                                : "Hours unavailable"}
                          </span>
                          {pharmacyData.recommended.rating ? (
                            <span className="flat-chip">
                              Rating {pharmacyData.recommended.rating.toFixed(1)}
                            </span>
                          ) : null}
                          <span className="flat-chip">
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
                                  <div className="flat-chip text-xs text-slate-600">
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
                      Medication signal unavailable
                    </div>
                    <p className="mt-3 text-base leading-7">{drugError}</p>
                  </div>
                ) : featuredMatch ? (
                  <>
                    <div className="surface-panel rounded-[2rem] p-6 sm:p-7">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <span className="eyebrow-label">FDA-derived access signal</span>
                          <h2 className="mt-4 text-2xl tracking-tight text-slate-950">
                            {featuredMatch.display_name}
                          </h2>
                          <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-500">
                            {featuredMatch.canonical_label}
                          </p>
                        </div>
                        <SignalBadge signal={featuredMatch.access_signal} />
                      </div>

                      <p className="mt-5 text-base leading-7 text-slate-700">
                        {featuredMatch.patient_view.summary}
                      </p>

                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <MetricPill
                          label="FDA listings"
                          value={String(featuredMatch.active_listing_count)}
                        />
                        <MetricPill
                          label="Manufacturers"
                          value={String(featuredMatch.manufacturers.length)}
                        />
                        <MetricPill
                          label="Shortage entries"
                          value={String(featuredMatch.evidence.shortages.active_count)}
                        />
                        <MetricPill
                          label="Recent recalls"
                          value={String(featuredMatch.evidence.recalls.recent_count)}
                        />
                      </div>

                      <p className="mt-5 text-sm leading-6 text-slate-500">
                        Dataset freshness:{" "}
                        {drugData ? buildFreshnessLine(drugData) : "FDA freshness unavailable for this request."}
                      </p>
                    </div>

                    <div className="surface-panel rounded-[2rem] p-6">
                      <span className="eyebrow-label">What we know</span>
                      <CalloutList className="mt-5" items={featuredMatch.patient_view.what_we_know} />
                    </div>

                    <div className="surface-panel rounded-[2rem] p-6">
                      <span className="eyebrow-label">What may make it harder</span>
                      <CalloutList
                        className="mt-5"
                        items={featuredMatch.patient_view.what_may_make_it_harder}
                      />
                    </div>

                    <div className="surface-panel rounded-[2rem] p-6">
                      <span className="eyebrow-label">Questions to ask next</span>
                      <CalloutList className="mt-5" items={featuredMatch.patient_view.questions_to_ask} />
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                          href={`/drug?query=${encodeURIComponent(query)}&id=${encodeURIComponent(featuredMatch.id)}&location=${encodeURIComponent(location)}`}
                          className="rounded-full bg-slate-950 px-[18px] py-[15px] text-sm font-medium leading-4 text-white transition-all duration-200 hover:rounded-2xl"
                        >
                          Open drug detail
                        </Link>
                        <Link
                          href={`/prescriber?query=${encodeURIComponent(query)}&id=${encodeURIComponent(featuredMatch.id)}&location=${encodeURIComponent(location)}`}
                          className="rounded-full border border-slate-300 px-[18px] py-[15px] text-sm font-medium leading-4 text-slate-900 transition-all duration-200 hover:rounded-2xl"
                        >
                          Open prescriber view
                        </Link>
                      </div>
                    </div>

                    <div className="surface-panel rounded-[2rem] p-6">
                      <span className="eyebrow-label">Important limitation</span>
                      <CalloutList className="mt-5" items={featuredMatch.patient_view.unavailable} />
                    </div>
                  </>
                ) : (
                  <EmptyState
                    eyebrow="No FDA match"
                    title={`No clear FDA medication family surfaced for “${query}”.`}
                    body="The nearby pharmacy list can still be live even when the FDA match is weak. Try simplifying the medication name or removing extra wording."
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
