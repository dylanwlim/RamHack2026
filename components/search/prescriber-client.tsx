"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createPharmaPathClient, type DrugIntelligenceResponse } from "@/lib/pharmapath-client";
import { MedicationQueryForm } from "@/components/search/medication-query-form";
import {
  CalloutList,
  EmptyState,
  MetricPill,
  SignalBadge,
  TagList,
} from "@/components/search/shared";

const client = createPharmaPathClient();

export function PrescriberClient() {
  const searchParams = useSearchParams();
  const query = searchParams.get("query")?.trim() || "";
  const matchId = searchParams.get("id")?.trim() || "";
  const location = searchParams.get("location")?.trim() || "";
  const [payload, setPayload] = useState<DrugIntelligenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedMatch = useMemo(() => {
    if (!payload?.matches?.length) {
      return null;
    }

    return payload.matches.find((match) => match.id === matchId) || payload.matches[0];
  }, [payload, matchId]);

  useEffect(() => {
    if (!query) {
      setPayload(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client
      .getDrugIntelligence(query)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setPayload(result);
        setError(null);
        setIsLoading(false);
      })
      .catch((reason: Error) => {
        if (cancelled) {
          return;
        }

        setPayload(null);
        setError(reason.message);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <>
      <section className="px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <div className="site-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <span className="eyebrow-label">Prescriber intelligence</span>
            <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.4rem]">
              Evidence trail first, routing question second.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              This route keeps shortage context, manufacturer spread, recall evidence, and
              formulation coverage visible for clinical planning.
            </p>
          </div>

          <MedicationQueryForm
            action="/prescriber"
            initialQuery={query}
            submitLabel="Run prescriber search"
            helper="Use this when the question is clinical planning, not store-level inventory."
          />
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="site-shell space-y-6">
          {!query ? (
            <EmptyState
              eyebrow="Ready when you are"
              title="Search for a medication to load the prescriber view."
              body="The prescriber route focuses on shortage, recall, formulation, and manufacturer context rather than the patient-facing explanation."
            />
          ) : isLoading ? (
            <div className="surface-panel flex min-h-[24rem] items-center justify-center rounded-[2rem]">
              <div className="flex items-center gap-3 text-slate-500">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Loading prescriber intelligence...
              </div>
            </div>
          ) : error ? (
            <div className="surface-panel rounded-[2rem] border-rose-200 bg-rose-50 p-6 text-rose-700">
              <div className="text-sm font-medium uppercase tracking-[0.18em]">
                Unable to load prescriber intelligence
              </div>
              <p className="mt-3 text-base leading-7">{error}</p>
            </div>
          ) : !selectedMatch ? (
            <EmptyState
              eyebrow="No FDA match"
              title={`No clear FDA medication family surfaced for “${query}”.`}
              body="Try a cleaner brand or generic name so the prescriber evidence can attach to a more specific FDA family."
            />
          ) : (
            <>
              <div className="surface-panel rounded-[2rem] p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="eyebrow-label">Selected medication family</span>
                    <h2 className="mt-4 text-3xl tracking-tight text-slate-950">
                      {selectedMatch.display_name}
                    </h2>
                    <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-500">
                      {selectedMatch.canonical_label}
                    </p>
                  </div>
                  <SignalBadge signal={selectedMatch.access_signal} />
                </div>

                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-700">
                  {selectedMatch.prescriber_view.summary}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-4">
                  <MetricPill label="Active listings" value={String(selectedMatch.active_listing_count)} />
                  <MetricPill label="Manufacturers" value={String(selectedMatch.manufacturers.length)} />
                  <MetricPill
                    label="Shortage records"
                    value={String(selectedMatch.evidence.shortages.active_count)}
                  />
                  <MetricPill
                    label="Recent recalls"
                    value={String(selectedMatch.evidence.recalls.recent_count)}
                  />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-6">
                  <div className="surface-panel rounded-[2rem] p-6">
                    <span className="eyebrow-label">Operational takeaways</span>
                    <CalloutList className="mt-5" items={selectedMatch.prescriber_view.takeaways} />
                  </div>

                  <div className="surface-panel rounded-[2rem] p-6">
                    <span className="eyebrow-label">Formulation spread</span>
                    <div className="mt-5 space-y-6">
                      <div>
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">Strengths</div>
                        <div className="mt-3">
                          <TagList items={selectedMatch.strengths} />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                          Routes and dosage forms
                        </div>
                        <div className="mt-3">
                          <TagList items={[...selectedMatch.routes, ...selectedMatch.dosage_forms]} />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                          Manufacturers
                        </div>
                        <div className="mt-3">
                          <TagList items={selectedMatch.manufacturers} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="surface-panel rounded-[2rem] p-6">
                    <span className="eyebrow-label">Alternative planning</span>
                    <h3 className="mt-5 text-xl tracking-tight text-slate-950">
                      {selectedMatch.prescriber_view.should_consider_alternatives
                        ? "Worth considering earlier"
                        : "No strong trigger from FDA data alone"}
                    </h3>
                    <p className="mt-3 text-base leading-7 text-slate-700">
                      {selectedMatch.prescriber_view.should_consider_alternatives
                        ? "Because the returned FDA signals are not cleanly steady, it is reasonable to think about backup formulations, strengths, or therapeutic alternatives sooner."
                        : "The returned FDA data does not show a strong reason to abandon the original plan immediately, though local fill success may still vary."}
                    </p>
                  </div>

                  <div className="surface-panel rounded-[2rem] p-6">
                    <span className="eyebrow-label">Evidence trail</span>
                    <div className="mt-5 space-y-5">
                      <div>
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                          Shortage and discontinuation entries
                        </div>
                        {selectedMatch.evidence.shortages.items.length ? (
                          <CalloutList
                            className="mt-3"
                            items={selectedMatch.evidence.shortages.items.map(
                              (item) =>
                                `${item.status} · ${item.presentation || item.shortageReason || "No presentation detail available."}`,
                            )}
                          />
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            No matching shortage entry surfaced for this product family.
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                          Recall notices
                        </div>
                        {selectedMatch.evidence.recalls.items.length ? (
                          <CalloutList
                            className="mt-3"
                            items={selectedMatch.evidence.recalls.items.map(
                              (item) =>
                                `${item.classification || item.status || "Recall"} · ${item.reason || item.productDescription || "No recall reason provided."}`,
                            )}
                          />
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            No matching recall notice surfaced in the recent FDA enforcement data.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={
                    location
                      ? `/patient/results?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&radiusMiles=5&sortBy=best_match&onlyOpenNow=false`
                      : `/patient`
                  }
                  className="rounded-full border border-slate-300 px-[18px] py-[15px] text-sm font-medium leading-4 text-slate-900 transition-all duration-200 hover:rounded-2xl"
                >
                  Open patient view
                </Link>
                <Link
                  href={`/drug?query=${encodeURIComponent(query)}&id=${encodeURIComponent(selectedMatch.id)}${location ? `&location=${encodeURIComponent(location)}` : ""}`}
                  className="rounded-full bg-slate-950 px-[18px] py-[15px] text-sm font-medium leading-4 text-white transition-all duration-200 hover:rounded-2xl"
                >
                  Open drug detail
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
