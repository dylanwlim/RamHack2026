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
  TagList,
  formatDisplayDate,
} from "@/components/search/shared";

const client = createPharmaPathClient();

type Match = DrugIntelligenceResponse["matches"][number];
type ShortageItem = Match["evidence"]["shortages"]["items"][number];

// ─── data helpers ──────────────────────────────────────────────────────────

function normalizedStatus(s: ShortageItem) {
  return s.normalizedStatus ?? s.status?.toLowerCase() ?? "";
}

function computeSeverityScore(items: ShortageItem[]): number {
  const active = items.filter((s) => normalizedStatus(s) === "active");
  const total = items.length;
  const available = items.filter((s) => {
    const ns = normalizedStatus(s);
    return ns === "available" || ns === "producing";
  }).length;
  const supplyPenalty = total > 0 ? (1 - available / total) * 50 : 0;
  const now = Date.now();
  const earliestMs = active
    .map((s) => (s.updateDate ? new Date(s.updateDate).getTime() : null))
    .filter((t): t is number => t !== null && !isNaN(t))
    .sort((a, b) => a - b)[0];
  const daysSinceStart = earliestMs
    ? Math.floor((now - earliestMs) / 86_400_000)
    : 0;
  const durationPenalty = Math.min(daysSinceStart / 365, 1) * 30;
  const volumePenalty = Math.min(active.length, 5) * 4;
  return Math.min(Math.round(supplyPenalty + durationPenalty + volumePenalty), 100);
}

type SeverityTier = {
  label: string;
  sublabel: string;
  color: string;
  tailwindText: string;
  tailwindBg: string;
  tailwindBorder: string;
};

function severityTier(score: number): SeverityTier {
  if (score <= 10)
    return {
      label: "Usually fillable",
      sublabel: "No active shortage in FDA data",
      color: "#22c55e",
      tailwindText: "text-emerald-700",
      tailwindBg: "bg-emerald-50",
      tailwindBorder: "border-emerald-200",
    };
  if (score <= 30)
    return {
      label: "Some friction",
      sublabel: "Mild shortage — monitor and plan ahead",
      color: "#eab308",
      tailwindText: "text-yellow-700",
      tailwindBg: "bg-yellow-50",
      tailwindBorder: "border-yellow-200",
    };
  if (score <= 60)
    return {
      label: "Hard to fill right now",
      sublabel: "Moderate shortage — consider alternatives",
      color: "#f97316",
      tailwindText: "text-orange-700",
      tailwindBg: "bg-orange-50",
      tailwindBorder: "border-orange-200",
    };
  return {
    label: "Severe shortage",
    sublabel: "Limited supply nationally — prescribe alternatives",
    color: "#ef4444",
    tailwindText: "text-rose-700",
    tailwindBg: "bg-rose-50",
    tailwindBorder: "border-rose-200",
  };
}

function formatDuration(days: number): string {
  if (!days || days <= 0) return "—";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  const y = days / 365;
  return `${y.toFixed(1)} yr`;
}

function buildDoseAvailability(items: ShortageItem[]) {
  const map = new Map<string, { available: number; total: number }>();
  for (const s of items) {
    const m = s.presentation?.match(/(\d+(?:\.\d+)?)\s*mg/i);
    const dose = m
      ? `${m[1]} mg`
      : s.presentation
        ? s.presentation.slice(0, 28)
        : null;
    if (!dose) continue;
    const entry = map.get(dose) ?? { available: 0, total: 0 };
    entry.total += 1;
    const ns = normalizedStatus(s);
    if (ns === "available" || ns === "producing") entry.available += 1;
    map.set(dose, entry);
  }
  return Array.from(map.entries())
    .map(([dose, c]) => ({ dose, ...c, pct: c.total > 0 ? Math.round((c.available / c.total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);
}

function buildManufacturerRows(items: ShortageItem[]) {
  const map = new Map<string, { status: string; doses: Set<string>; updateLabel?: string }>();
  for (const s of items) {
    if (!s.companyName) continue;
    const key = s.companyName;
    const row = map.get(key) ?? { status: normalizedStatus(s), doses: new Set(), updateLabel: s.updateLabel };
    const m = s.presentation?.match(/(\d+(?:\.\d+)?)\s*mg/i);
    if (m) row.doses.add(`${m[1]} mg`);
    const priority: Record<string, number> = { active: 4, shortage: 3, available: 2, producing: 1, resolved: 0 };
    if ((priority[normalizedStatus(s)] ?? 0) > (priority[row.status] ?? 0)) {
      row.status = normalizedStatus(s);
    }
    map.set(key, row);
  }
  return Array.from(map.entries())
    .map(([name, r]) => ({ name, status: r.status, doses: Array.from(r.doses), updateLabel: r.updateLabel }))
    .sort((a, b) => {
      const p: Record<string, number> = { active: 3, shortage: 2, available: 1, producing: 0 };
      return (p[b.status] ?? 0) - (p[a.status] ?? 0);
    });
}

function mfgStatusStyle(status: string) {
  if (status === "active" || status === "shortage")
    return { dot: "bg-rose-500", text: "text-rose-700", label: "In shortage" };
  if (status === "available" || status === "producing")
    return { dot: "bg-emerald-500", text: "text-emerald-700", label: "Producing" };
  return { dot: "bg-slate-400", text: "text-slate-500", label: "Discontinued" };
}

// ─── subcomponents ─────────────────────────────────────────────────────────

function SpectrumBar({ score }: { score: number }) {
  const pct = Math.max(2, Math.min(98, score));
  return (
    <div className="relative mt-1 h-5">
      <div
        className="absolute inset-y-[7px] left-0 right-0 rounded-full"
        style={{ background: "linear-gradient(to right, #22c55e 0%, #eab308 30%, #f97316 60%, #ef4444 100%)" }}
      />
      <div
        className="absolute top-0 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-slate-800 shadow-md"
        style={{ left: `${pct}%` }}
      />
      <div className="absolute -bottom-5 left-0 text-[10px] text-slate-400">Easy to fill</div>
      <div className="absolute -bottom-5 right-0 text-[10px] text-slate-400">Severe</div>
    </div>
  );
}

function DoseGrid({ doses }: { doses: ReturnType<typeof buildDoseAvailability> }) {
  if (!doses.length) return null;
  return (
    <div className="surface-panel rounded-[2rem] p-6">
      <span className="eyebrow-label">Availability by dose</span>
      <p className="mt-3 text-xs text-slate-500">
        Each dose shows how many manufacturers are currently producing vs. total in shortage.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {doses.map((d, i) => {
          const bg =
            d.pct === 0
              ? "bg-rose-100 border-rose-300 text-rose-800"
              : d.pct < 50
                ? "bg-orange-100 border-orange-300 text-orange-800"
                : d.pct < 100
                  ? "bg-yellow-100 border-yellow-300 text-yellow-800"
                  : "bg-emerald-100 border-emerald-300 text-emerald-800";
          return (
            <div key={i} className={`flex flex-col items-center rounded-xl border px-3 py-2 min-w-[60px] ${bg}`}>
              <span className="text-sm font-semibold">{d.dose}</span>
              <span className="mt-0.5 text-[10px] font-medium opacity-80">
                {d.available}/{d.total} producing
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> All producing</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-yellow-400" /> Some producing</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-orange-400" /> Few producing</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-400" /> None producing</span>
      </div>
    </div>
  );
}

function ManufacturerList({ rows }: { rows: ReturnType<typeof buildManufacturerRows> }) {
  const [showAll, setShowAll] = useState(false);
  if (!rows.length) return null;
  const visible = showAll ? rows : rows.slice(0, 5);
  const hidden = rows.length - 5;
  return (
    <div className="surface-panel rounded-[2rem] p-6">
      <span className="eyebrow-label">Manufacturer status</span>
      <p className="mt-3 text-xs text-slate-500">
        FDA-listed manufacturers for matching presentations.
      </p>
      <div className="mt-4 divide-y divide-slate-100">
        {visible.map((r, i) => {
          const style = mfgStatusStyle(r.status);
          return (
            <div key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{r.name}</div>
                {r.doses.length > 0 ? (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {r.doses.map((d, j) => (
                      <span key={j} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                        {d}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <span className={`shrink-0 text-xs font-medium ${style.text}`}>{style.label}</span>
            </div>
          );
        })}
      </div>
      {rows.length > 5 ? (
        <button
          type="button"
          className="mt-3 text-sm text-[#156d95]"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show fewer" : `Show ${hidden} more`}
        </button>
      ) : null}
    </div>
  );
}

// ─── shortage evidence panel (right column) ───────────────────────────────

function ShortageEvidencePanel({
  match,
  drugData,
}: {
  match: Match;
  drugData: DrugIntelligenceResponse;
}) {
  const items = match.evidence.shortages.items;
  const activeShortages = items.filter((s) => normalizedStatus(s) === "active");
  const hasRecalls = match.evidence.recalls.recent_count > 0;

  const score = computeSeverityScore(items);
  const tier = severityTier(score);
  const doses = buildDoseAvailability(items);
  const mfgRows = buildManufacturerRows(items);

  const now = Date.now();
  const earliestActiveMs = activeShortages
    .map((s) => (s.updateDate ? new Date(s.updateDate).getTime() : null))
    .filter((t): t is number => t !== null && !isNaN(t))
    .sort((a, b) => a - b)[0];
  const durationDays = earliestActiveMs
    ? Math.floor((now - earliestActiveMs) / 86_400_000)
    : 0;

  const lastUpdate = activeShortages.find((s) => s.updateLabel)?.updateLabel ?? "Unknown";
  const reasons = Array.from(
    new Set(activeShortages.map((s) => s.shortageReason).filter(Boolean)),
  ).slice(0, 2) as string[];

  return (
    <>
      {/* ── Hero verdict card ── */}
      <div className={`surface-panel rounded-[2rem] p-6 sm:p-7 border ${tier.tailwindBorder} ${tier.tailwindBg}`}>
        <span className="eyebrow-label">FDA Drug Shortage Intelligence</span>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className={`text-2xl font-bold tracking-tight ${tier.tailwindText}`}>
              {tier.label}
            </div>
            <div className="mt-1 text-sm text-slate-600">{tier.sublabel}</div>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-black tabular-nums ${tier.tailwindText}`}>{score}</div>
            <div className="text-xs text-slate-500">out of 100</div>
          </div>
        </div>

        <div className="mb-8 mt-6">
          <SpectrumBar score={score} />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { label: "Duration", value: formatDuration(durationDays) },
            { label: "Last update", value: lastUpdate },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/70 bg-white/60 p-3 text-center backdrop-blur-sm">
              <div className="truncate text-sm font-semibold text-slate-900" title={value}>{value}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        {(reasons[0] ?? null) && (
          <div className="mt-2 rounded-xl border border-white/70 bg-white/60 p-3 backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Cause</div>
            <div className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{reasons[0]}</div>
          </div>
        )}

        <div className="mt-4 text-[10px] text-slate-400">
          Shortage data as of {formatDisplayDate(drugData.data_freshness.shortages_last_updated)} ·
          Recalls as of {formatDisplayDate(drugData.data_freshness.recalls_last_updated)}
        </div>
      </div>

      {/* ── Dose availability heat map ── */}
      <DoseGrid doses={doses} />

      {/* ── Manufacturer status ── */}
      <ManufacturerList rows={mfgRows} />

      {/* ── Active FDA shortage entries ── */}
      {activeShortages.length > 0 ? (
        <div className="surface-panel rounded-[2rem] p-6">
          <span className="eyebrow-label">Active FDA shortage entries</span>
          <div className="mt-5 space-y-3">
            {activeShortages.slice(0, 6).map((s, i) => (
              <div key={i} className="rounded-[1.2rem] border border-rose-100 bg-rose-50 p-4">
                {s.presentation ? (
                  <div className="text-sm font-medium text-slate-900">{s.presentation}</div>
                ) : null}
                {s.companyName ? (
                  <div className="mt-0.5 text-xs text-slate-500">{s.companyName}</div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                  {s.shortageReason ? <span><span className="font-medium">Reason:</span> {s.shortageReason}</span> : null}
                  {s.availability ? <span><span className="font-medium">Status:</span> {s.availability}</span> : null}
                  {s.updateLabel ? <span className="text-slate-400">Updated {s.updateLabel}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Recent recalls ── */}
      {hasRecalls ? (
        <div className="surface-panel rounded-[2rem] p-6">
          <span className="eyebrow-label">Recent recall activity</span>
          <div className="mt-5 space-y-3">
            {match.evidence.recalls.items.slice(0, 4).map((r, i) => (
              <div key={i} className="rounded-[1.2rem] border border-amber-100 bg-amber-50 p-4">
                {r.productDescription ? (
                  <div className="text-sm font-medium text-slate-900">{r.productDescription}</div>
                ) : null}
                {r.recallingFirm ? (
                  <div className="mt-0.5 text-xs text-slate-500">{r.recallingFirm}</div>
                ) : null}
                {r.reason ? (
                  <div className="mt-1.5 text-sm text-slate-600">{r.reason}</div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  {r.classification ? (
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 font-semibold">
                      Class {r.classification}
                    </span>
                  ) : null}
                  {r.reportDateLabel ? <span>{r.reportDateLabel}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[1.5rem] border border-slate-200 bg-white/60 px-5 py-4 text-xs leading-6 text-slate-500">
        Data from <strong>FDA openFDA Drug Shortages &amp; Enforcement APIs</strong>. Updated daily.
        Informational only — confirm with your pharmacist or prescriber before making any decisions.
      </div>
    </>
  );
}

// ─── page component ────────────────────────────────────────────────────────

export function PrescriberClient() {
  const searchParams = useSearchParams();
  const query = searchParams.get("query")?.trim() || "";
  const matchId = searchParams.get("id")?.trim() || "";
  const location = searchParams.get("location")?.trim() || "";
  const [payload, setPayload] = useState<DrugIntelligenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedMatch = useMemo(() => {
    if (!payload?.matches?.length) return null;

    if (matchId) {
      const pinned = payload.matches.find((m) => m.id === matchId);
      if (pinned) return pinned;
    }

    if (payload.featured_match_id) {
      const featured = payload.matches.find((m) => m.id === payload.featured_match_id);
      if (featured) return featured;
    }

    return payload.matches.reduce((best, m) =>
      (m.active_listing_count ?? 0) > (best.active_listing_count ?? 0) ? m : best,
    );
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
        if (cancelled) return;
        setPayload(result);
        setError(null);
        setIsLoading(false);
      })
      .catch((reason: Error) => {
        if (cancelled) return;
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
              Shortage severity, manufacturer spread, dose availability, and recall evidence
              for clinical planning.
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
        <div className="site-shell">
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
              title={`No clear FDA medication family surfaced for "${query}".`}
              body="Try a cleaner brand or generic name so the prescriber evidence can attach to a more specific FDA family."
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              {/* ── Left: drug identity + clinical context ── */}
              <div className="space-y-6">
                <div className="surface-panel rounded-[2rem] p-6 sm:p-7">
                  <span className="eyebrow-label">Selected medication family</span>
                  <h2 className="mt-4 text-3xl tracking-tight text-slate-950">
                    {selectedMatch.display_name}
                  </h2>
                  <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-500">
                    {selectedMatch.canonical_label}
                  </p>
                  <p className="mt-5 max-w-3xl text-base leading-7 text-slate-700">
                    {selectedMatch.prescriber_view.summary}
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Active listings", value: String(selectedMatch.active_listing_count) },
                      { label: "Manufacturers", value: String(selectedMatch.manufacturers.length) },
                      { label: "Shortage records", value: String(selectedMatch.evidence.shortages.active_count) },
                      { label: "Recent recalls", value: String(selectedMatch.evidence.recalls.recent_count) },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-white/70 p-3 text-center">
                        <div className="text-xl font-black tabular-nums text-slate-900">{value}</div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Clinical recommendation ── */}
                <div className="surface-panel flex items-start gap-4 rounded-[2rem] border border-violet-200 bg-violet-50 p-5">
                  <span className="mt-0.5 shrink-0 text-lg font-bold text-violet-600" aria-hidden>Rx</span>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-violet-500">
                      Clinical recommendation
                    </div>
                    <p className="mt-1 text-sm leading-6 text-violet-900">
                      {selectedMatch.prescriber_view.should_consider_alternatives
                        ? "FDA shortage data supports considering alternatives earlier. Discuss backup formulations or therapeutic substitutes with the patient."
                        : "No strong FDA trigger to abandon the current plan. Monitor fill status and have alternatives ready if the patient reports difficulty."}
                    </p>
                  </div>
                </div>

                {/* ── Operational takeaways ── */}
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
                      <div className="text-sm uppercase tracking-[0.18em] text-slate-500">Routes and dosage forms</div>
                      <div className="mt-3">
                        <TagList items={[...selectedMatch.routes, ...selectedMatch.dosage_forms]} />
                      </div>
                    </div>
                    {selectedMatch.manufacturers.length > 0 && (
                      <div>
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">FDA-listed manufacturers</div>
                        <div className="mt-3">
                          <TagList items={selectedMatch.manufacturers} />
                        </div>
                      </div>
                    )}
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
                </div>
              </div>

              {/* ── Right: shortage evidence ── */}
              <div className="space-y-6">
                <ShortageEvidencePanel match={selectedMatch} drugData={payload!} />
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
