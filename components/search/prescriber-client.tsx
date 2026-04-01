"use client";

import NextLink from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { ExampleScenarioGrid } from "@/components/search/example-scenario-grid";
import {
  createPharmaPathClient,
  type DrugIntelligenceResponse,
} from "@/lib/pharmapath-client";
import { MedicationQueryForm } from "@/components/search/medication-query-form";
import { CalloutList, EmptyState, TagList } from "@/components/search/shared";
import {
  ShortageIntelligencePanel,
  selectMedicationMatch,
} from "@/components/search/shortage-intelligence-panel";
import { openSurfaceLabels, surfaceNames } from "@/lib/surface-labels";

const client = createPharmaPathClient();

type MedicationMatch = DrugIntelligenceResponse["matches"][number];
type OverviewMetric = { label: string; value: string };

function PrescriberResultsLayout({
  match,
  dataFreshness,
  overviewMetrics,
  routingRecommendation,
  patientFinderHref,
}: {
  match: MedicationMatch;
  dataFreshness: DrugIntelligenceResponse["data_freshness"];
  overviewMetrics: OverviewMetric[];
  routingRecommendation: string;
  patientFinderHref: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className="surface-panel rounded-[2rem] p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-label">
              {match.demo_context?.demo_only
                ? "Selected demo medication"
                : "Selected medication family"}
            </span>
            {match.demo_context?.demo_only ? (
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                Demo
              </span>
            ) : null}
          </div>
          <h2 className="mt-4 text-3xl tracking-tight text-slate-950">
            {match.display_name}
          </h2>
          <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-500">
            {match.canonical_label}
          </p>
          {match.demo_context?.demo_only ? (
            <p className="mt-3 text-sm leading-6 text-amber-900">
              {match.demo_context.note}{" "}
              {match.demo_context.simulated_user_count || 0} seeded demo users
              are included for this variant, and the signal remains explicitly
              simulated.
            </p>
          ) : null}
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-700">
            {match.prescriber_view.summary}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overviewMetrics.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-[1.3rem] border border-slate-200 bg-white/70 p-3 text-center"
              >
                <div className="text-xl font-black tabular-nums text-slate-900">
                  {value}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="surface-panel rounded-[2rem] p-6">
            <span className="eyebrow-label">Routing recommendation</span>
            <p className="mt-4 text-sm leading-6 text-slate-700">
              {routingRecommendation}
            </p>
            <CalloutList
              className="mt-5"
              items={match.prescriber_view.takeaways}
            />
          </section>

          <section className="surface-panel rounded-[2rem] p-6">
            <span className="eyebrow-label">Formulation coverage</span>
            <div className="mt-5 space-y-5">
              <div>
                <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                  Strengths
                </div>
                <div className="mt-3">
                  <TagList items={match.strengths} />
                </div>
              </div>
              <div>
                <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                  Routes and dosage forms
                </div>
                <div className="mt-3">
                  <TagList items={[...match.routes, ...match.dosage_forms]} />
                </div>
              </div>
              {match.manufacturers.length > 0 ? (
                <div>
                  <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                    {match.demo_context?.demo_only
                      ? "Simulated manufacturers"
                      : "Listed manufacturers"}
                  </div>
                  <div className="mt-3">
                    <TagList items={match.manufacturers} />
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-[2rem] border border-violet-200 bg-violet-50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="eyebrow-label text-violet-700">
                Patient handoff
              </span>
              <p className="mt-3 max-w-xl text-sm leading-6 text-violet-950">
                Carry this medication family into {surfaceNames.patient} when
                you need nearby routing in parallel with the evidence summary
                above.
              </p>
            </div>
            <NextLink
              href={patientFinderHref}
              className="action-button-secondary text-sm"
            >
              {openSurfaceLabels.patient}
            </NextLink>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <ShortageIntelligencePanel
          match={match}
          dataFreshness={dataFreshness}
          variant="prescriber"
        />
      </div>
    </div>
  );
}

export function PrescriberClient({
  initialQuery = "",
  initialMatchId = "",
  initialLocation = "",
}: {
  initialQuery?: string;
  initialMatchId?: string;
  initialLocation?: string;
}) {
  const query = initialQuery.trim();
  const matchId = initialMatchId.trim();
  const location = initialLocation.trim();
  const showExampleScenarios = !query;
  const [payload, setPayload] = useState<DrugIntelligenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCompletedQuery, setLastCompletedQuery] = useState<string | null>(
    null,
  );
  const activePayload = query ? payload : null;
  const activeError = query ? error : null;
  const isLoading = Boolean(query) && lastCompletedQuery !== query;

  const selectedMatch = useMemo(
    () =>
      selectMedicationMatch(activePayload?.matches, {
        preferredId: matchId,
        featuredId: activePayload?.featured_match_id,
      }),
    [activePayload, matchId],
  );

  useEffect(() => {
    if (!query) {
      return;
    }

    let isStale = false;

    async function loadMedicationEvidence() {
      try {
        const response = await client.getDrugIntelligence(query);

        if (isStale) {
          return;
        }

        setPayload(response);
        setError(null);
        setLastCompletedQuery(query);
      } catch (reason) {
        if (isStale) {
          return;
        }

        setPayload(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load medication data.",
        );
        setLastCompletedQuery(query);
      }
    }

    void loadMedicationEvidence();

    return () => {
      isStale = true;
    };
  }, [query]);

  const patientFinderHref = location
    ? `/patient/results?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&radiusMiles=5&sortBy=best_match&onlyOpenNow=false`
    : "/patient";
  const overviewMetrics: OverviewMetric[] = selectedMatch
    ? [
        {
          label: "Active listings",
          value: String(selectedMatch.active_listing_count),
        },
        {
          label: "Manufacturers",
          value: String(selectedMatch.manufacturers.length),
        },
        {
          label: "Shortage records",
          value: String(selectedMatch.evidence.shortages.active_count),
        },
        {
          label: "Recent recalls",
          value: String(selectedMatch.evidence.recalls.recent_count),
        },
      ]
    : [];
  const resultsShellClassName = "site-shell";
  const routingRecommendation = !selectedMatch
    ? ""
    : selectedMatch.prescriber_view.should_consider_alternatives
      ? selectedMatch.demo_context?.demo_only
        ? "The simulated demo signal supports lining up backup formulations earlier so the prescriber flow shows formulation-aware decision making."
        : "Current shortage pressure supports discussing backup formulations or therapeutic substitutes earlier in the conversation."
      : selectedMatch.demo_context?.demo_only
        ? "The simulated demo signal does not force an immediate switch, but it still keeps alternate strengths and release types visible."
        : "No strong shortage trigger forces an immediate switch, but it is still worth keeping alternatives ready if the patient reports fill difficulty.";

  return (
    <>
      <section className="px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <div className="site-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <span className="eyebrow-label">Prescriber view</span>
            <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.4rem]">
              Trace the evidence before you route the prescription.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Keep shortage pressure, manufacturer breadth, formulation
              coverage, and recall context visible while you decide how much
              contingency planning the prescription needs.
            </p>
          </div>

          <MedicationQueryForm
            action="/prescriber"
            initialQuery={query}
            submitLabel="Review medication"
            helper="Search the medication catalog, or the clearly isolated fictional medication set, when the question is clinical planning rather than store-level inventory."
          />
        </div>
      </section>

      {showExampleScenarios ? (
        <section className="px-4 pb-10 sm:px-6 lg:px-8">
          <div className="site-shell">
            <ExampleScenarioGrid
              mode="prescriber"
              eyebrow="Quick starts"
              title="Four useful starting points for Medication Lookup"
              description="These surface formulation, shortage, recall, and manufacturer context immediately, with any fictional seeded entries kept clearly separate."
            />
          </div>
        </section>
      ) : null}

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className={resultsShellClassName}>
          {!query ? (
            <EmptyState
              eyebrow="Ready when you are"
              title="Search a medication to load Medication Lookup."
              body="Medication Lookup keeps shortage, recall, formulation, and manufacturer evidence together for clinical planning."
            />
          ) : isLoading ? (
            <div className="surface-panel flex min-h-[24rem] items-center justify-center rounded-[2rem]">
              <div className="flex items-center gap-3 text-slate-500">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Loading medication evidence...
              </div>
            </div>
          ) : activeError ? (
            <div className="surface-panel rounded-[2rem] border-rose-200 bg-rose-50 p-6 text-rose-700">
              <div className="text-sm font-medium uppercase tracking-[0.18em]">
                Medication evidence unavailable
              </div>
              <p className="mt-3 text-base leading-7">{activeError}</p>
            </div>
          ) : !selectedMatch ? (
            <EmptyState
              eyebrow="No clear match"
              title={`No clear medication family surfaced for "${query}".`}
              body="Try a cleaner brand or generic name so the prescriber view can attach to a more specific match."
            />
          ) : (
            <PrescriberResultsLayout
              match={selectedMatch}
              dataFreshness={activePayload!.data_freshness}
              overviewMetrics={overviewMetrics}
              routingRecommendation={routingRecommendation}
              patientFinderHref={patientFinderHref}
            />
          )}
        </div>
      </section>
    </>
  );
}
