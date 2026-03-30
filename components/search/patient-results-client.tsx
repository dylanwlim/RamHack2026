"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, LoaderCircle, MapPin, PhoneCall } from "lucide-react";
import { CrowdSignalCard } from "@/components/crowd-signal/crowd-signal-card";
import {
  createPharmaPathClient,
  type DrugIntelligenceResponse,
  type PharmacySearchResponse,
} from "@/lib/pharmapath-client";
import { useAuth } from "@/lib/auth/auth-context";
import { subscribeToCrowdReportsForMedication } from "@/lib/crowd-signal/firestore";
import { buildCrowdSignalMap, buildSignalKey } from "@/lib/crowd-signal/scoring";
import { saveRecentSearch } from "@/lib/profile/profile-service";
import { PharmacySearchForm } from "@/components/search/pharmacy-search-form";
import {
  CalloutList,
  EmptyState,
  MetricPill,
  formatDisplayDate,
  formatMiles,
  formatRecallClassification,
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
  color: string;         // hex for inline SVG
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
      sublabel: "Mild shortage — may need a few calls",
      color: "#eab308",
      tailwindText: "text-yellow-700",
      tailwindBg: "bg-yellow-50",
      tailwindBorder: "border-yellow-200",
    };
  if (score <= 60)
    return {
      label: "Hard to fill right now",
      sublabel: "Moderate shortage — ask about alternatives",
      color: "#f97316",
      tailwindText: "text-orange-700",
      tailwindBg: "bg-orange-50",
      tailwindBorder: "border-orange-200",
    };
  return {
    label: "Severe shortage",
    sublabel: "Limited supply nationally — act now",
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

/** Deduplicate manufacturers across shortage items and classify each */
function buildManufacturerRows(items: ShortageItem[]) {
  const map = new Map<string, { status: string; doses: Set<string>; updateLabel?: string }>();
  for (const s of items) {
    if (!s.companyName) continue;
    const key = s.companyName;
    const row = map.get(key) ?? { status: normalizedStatus(s), doses: new Set(), updateLabel: s.updateLabel };
    const m = s.presentation?.match(/(\d+(?:\.\d+)?)\s*mg/i);
    if (m) row.doses.add(`${m[1]} mg`);
    // upgrade status priority: active > shortage > available > producing > resolved
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

const INSIGHT_STYLE: Record<string, string> = {
  opportunity: "border-emerald-200 bg-emerald-50 text-emerald-900",
  timing: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-rose-200 bg-rose-50 text-rose-900",
  action: "border-violet-200 bg-violet-50 text-violet-900",
};

const INSIGHT_ICON: Record<string, string> = {
  opportunity: "✓",
  timing: "◷",
  warning: "⚠",
  action: "→",
};

function classifyInsight(text: string) {
  if (/discontinu/i.test(text)) return "warning";
  if (/demand|quota|DEA/i.test(text)) return "timing";
  if (/ask|call|request|specifically/i.test(text)) return "action";
  if (/more than|higher|more active|alternative/i.test(text)) return "opportunity";
  return "warning";
}

// ─── subcomponents ─────────────────────────────────────────────────────────

/** Google Flights-style spectrum needle bar */
function SpectrumBar({ score }: { score: number }) {
  const pct = Math.max(2, Math.min(98, score));
  return (
    <div className="relative mt-1 h-5">
      {/* gradient track */}
      <div
        className="absolute inset-y-[7px] left-0 right-0 rounded-full"
        style={{ background: "linear-gradient(to right, #22c55e 0%, #eab308 30%, #f97316 60%, #ef4444 100%)" }}
      />
      {/* needle */}
      <div
        className="absolute top-0 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-slate-800 shadow-md"
        style={{ left: `${pct}%` }}
      />
      {/* track labels */}
      <div className="absolute -bottom-5 left-0 text-[10px] text-slate-400">Easy to fill</div>
      <div className="absolute -bottom-5 right-0 text-[10px] text-slate-400">Severe</div>
    </div>
  );
}

/** Dose availability pill grid — like the flight calendar heat map */
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
            <div
              key={i}
              className={`flex flex-col items-center rounded-xl border px-3 py-2 min-w-[60px] ${bg}`}
            >
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

/** Manufacturer status rows — like airline availability per flight */
function ManufacturerList({
  rows,
  isDemo = false,
}: {
  rows: ReturnType<typeof buildManufacturerRows>;
  isDemo?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  if (!rows.length) return null;
  const visible = showAll ? rows : rows.slice(0, 5);
  const hidden = rows.length - 5;
  return (
    <div className="surface-panel rounded-[2rem] p-6">
      <span className="eyebrow-label">Manufacturer status</span>
      <p className="mt-3 text-xs text-slate-500">
        {isDemo ? "Simulated manufacturers for matching demo presentations." : "FDA-listed manufacturers for matching presentations."}
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

// ─── main panel ────────────────────────────────────────────────────────────

function ShortagePanel({
  match,
  drugData,
}: {
  match: Match;
  drugData: DrugIntelligenceResponse;
  query: string;
  location: string;
}) {
  const items = match.evidence.shortages.items;
  const activeShortages = items.filter((s) => normalizedStatus(s) === "active");
  const hasRecalls = match.evidence.recalls.recent_count > 0;
  const isDemoMatch = Boolean(match.demo_context?.demo_only);

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

  const insights = match.patient_view.what_may_make_it_harder.map((text) => ({
    type: classifyInsight(text),
    text,
  }));
  const tierSublabel = isDemoMatch ? "Simulated demo medication context" : tier.sublabel;

  return (
    <>
      {/* ── Hero verdict card ── */}
      <div className={`surface-panel rounded-[2rem] p-6 sm:p-7 border ${tier.tailwindBorder} ${tier.tailwindBg}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow-label">
            {isDemoMatch ? "Demo Medication Intelligence" : "FDA Drug Shortage Intelligence"}
          </span>
          {isDemoMatch ? (
            <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800">
              Demo
            </span>
          ) : null}
        </div>

        {/* Big verdict */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className={`text-2xl font-bold tracking-tight ${tier.tailwindText}`}>
              {tier.label}
            </div>
            <div className="mt-1 text-sm text-slate-600">{tierSublabel}</div>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-black tabular-nums ${tier.tailwindText}`}>{score}</div>
            <div className="text-xs text-slate-500">out of 100</div>
          </div>
        </div>

        {/* Spectrum needle */}
        <div className="mb-8 mt-6">
          <SpectrumBar score={score} />
        </div>

        {/* Stats row */}
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
          {isDemoMatch
            ? `Simulated demo context • ${match.demo_context?.simulated_user_count || 0} seeded demo users`
            : `Shortage data as of ${formatDisplayDate(drugData.data_freshness.shortages_last_updated)} · Recalls as of ${formatDisplayDate(drugData.data_freshness.recalls_last_updated)}`}
        </div>
      </div>

      {/* ── Dose availability heat map ── */}
      <DoseGrid doses={doses} />

      {/* ── Manufacturer status ── */}
      <ManufacturerList rows={mfgRows} isDemo={isDemoMatch} />


      {/* ── Insights ── */}
      {insights.length > 0 ? (
        <div className="surface-panel rounded-[2rem] p-6">
          <span className="eyebrow-label">What this means for you</span>
          <div className="mt-5 space-y-3">
            {insights.map((insight, i) => (
              <div
                key={i}
                className={`flex gap-3 rounded-[1.2rem] border p-4 text-sm leading-6 ${INSIGHT_STYLE[insight.type] ?? INSIGHT_STYLE.warning}`}
              >
                <span className="mt-0.5 shrink-0 font-bold" aria-hidden>
                  {INSIGHT_ICON[insight.type] ?? "•"}
                </span>
                <p>{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Questions to ask ── */}
      <div className="surface-panel rounded-[2rem] p-6">
        <span className="eyebrow-label">Questions to ask your pharmacist</span>
        <CalloutList className="mt-5" items={match.patient_view.questions_to_ask} />
      </div>


      {/* ── Recent recalls ── */}
      {hasRecalls ? (
        <div className="surface-panel rounded-[2rem] p-6">
          <span className="eyebrow-label">Recent recall activity</span>
          <div className="mt-5 space-y-3">
            {match.evidence.recalls.items.slice(0, 3).map((recall, index) => {
              const classification = formatRecallClassification(recall.classification);

              return (
                <div key={index} className="rounded-[1.2rem] border border-amber-100 bg-amber-50 p-4">
                  {recall.productDescription ? (
                    <div className="text-sm font-medium text-slate-900">
                      {recall.productDescription}
                    </div>
                  ) : null}
                  {recall.recallingFirm ? (
                    <div className="mt-0.5 text-xs text-slate-500">{recall.recallingFirm}</div>
                  ) : null}
                  {recall.reason ? (
                    <div className="mt-1.5 text-sm text-slate-600">{recall.reason}</div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    {classification ? (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 font-semibold">
                        {classification}
                      </span>
                    ) : null}
                    {recall.reportDateLabel ? <span>{recall.reportDateLabel}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-[1.5rem] border border-slate-200 bg-white/60 px-5 py-4 text-xs leading-6 text-slate-500">
        {isDemoMatch ? (
          <>
            <strong>Simulated demo medication data.</strong> {match.demo_context?.note} Strengths,
            contributor counts, and shortage context are demo-only and kept separate from the
            FDA-backed catalog.
          </>
        ) : (
          <>
            Data from <strong>FDA openFDA Drug Shortages &amp; Enforcement APIs</strong>. Updated
            daily. Informational only — confirm with your pharmacist or prescriber before making
            any decisions.
          </>
        )}
      </div>
    </>
  );
}

export function PatientResultsClient() {
  const searchParams = useSearchParams();
  const query = searchParams.get("query")?.trim() || "";
  const location = searchParams.get("location")?.trim() || "";
  const locationPlaceId = searchParams.get("locationPlaceId")?.trim() || "";
  const radiusMiles = Number(searchParams.get("radiusMiles") || 5);
  const sortBy = (searchParams.get("sortBy") || "best_match") as "best_match" | "distance" | "rating";
  const onlyOpenNow = searchParams.get("onlyOpenNow") === "true";
  const { user } = useAuth();

  const [pharmacyData, setPharmacyData] = useState<PharmacySearchResponse | null>(null);
  const [drugData, setDrugData] = useState<DrugIntelligenceResponse | null>(null);
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);
  const [drugError, setDrugError] = useState<string | null>(null);
  const [crowdSignals, setCrowdSignals] = useState<Record<string, ReturnType<typeof buildCrowdSignalMap>[string]>>({});
  const [crowdReady, setCrowdReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const featuredMatch = useMemo(() => {
    if (!drugData?.matches?.length) {
      return null;
    }

    // Prefer the match pointed to by featured_match_id, then the one with the
    // most active listings (most data), then fall back to index 0.
    if (drugData.featured_match_id) {
      const pinned = drugData.matches.find((m) => m.id === drugData.featured_match_id);
      if (pinned) return pinned;
    }

    return drugData.matches.reduce((best, m) =>
      (m.active_listing_count ?? 0) > (best.active_listing_count ?? 0) ? m : best,
    );
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
        locationPlaceId: locationPlaceId || undefined,
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
  }, [query, location, locationPlaceId, radiusMiles, sortBy, onlyOpenNow]);

  useEffect(() => {
    if (!query) {
      setCrowdSignals({});
      setCrowdReady(true);
      return;
    }

    setCrowdReady(false);
    const unsubscribe = subscribeToCrowdReportsForMedication(query, (reports) => {
      setCrowdSignals(buildCrowdSignalMap(reports));
      setCrowdReady(true);
    });

    return () => unsubscribe();
  }, [query]);

  useEffect(() => {
    if (!user || !query || !location) {
      return;
    }

    void saveRecentSearch(user.uid, {
      medication: query,
      location,
      radiusMiles,
    });
  }, [location, query, radiusMiles, user]);

  const extraResults = pharmacyData?.results.slice(1) || [];
  const visibleExtras = showAll ? extraResults : extraResults.slice(0, 4);
  const isDemoMedication = Boolean(
    pharmacyData?.medication_profile.demo_only || featuredMatch?.demo_context?.demo_only || drugData?.data_source === "demo",
  );

  function getCrowdSignalForPharmacy(result: PharmacySearchResponse["results"][number], demoIndex = 0) {
    const signalKey = buildSignalKey({
      medicationQuery: query,
      placeId: result.place_id,
      pharmacyName: result.name,
      pharmacyAddress: result.address,
    });

    if (isDemoMedication) {
      type DemoSignalPreset = import("@/lib/crowd-signal/model").CrowdSignalSummary;
      const DEMO_SIGNAL_PRESETS: DemoSignalPreset[] = [
        {
          // index 0 — recommended pharmacy: strong positive
          signalKey,
          label: "Likely in stock",
          status: "likely_in_stock",
          confidenceLabel: "Moderate confidence",
          likelihood: 82,
          confidence: 0.76,
          agreement: 0.85,
          agreementDisplay: "11/13 recent",
          reportCount: 17,
          lastReportedAt: new Date(Date.now() - 1000 * 60 * 55),
          positiveWeight: 12.4,
          negativeWeight: 1.1,
          explanation: "Most recent reports indicate this medication was available or successfully filled here.",
          freshnessNote: "Latest report 55m ago",
          mixedSignal: false,
          sparseData: false,
          stale: false,
          direction: "positive",
        },
        {
          // index 1 — first extra: still positive, slightly lower confidence
          signalKey,
          label: "Likely in stock",
          status: "likely_in_stock",
          confidenceLabel: "Low-moderate confidence",
          likelihood: 68,
          confidence: 0.58,
          agreement: 0.71,
          agreementDisplay: "5/7 recent",
          reportCount: 8,
          lastReportedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
          positiveWeight: 6.1,
          negativeWeight: 1.8,
          explanation: "A majority of recent contributors reported availability, though sample size is limited.",
          freshnessNote: "Latest report 3h ago",
          mixedSignal: false,
          sparseData: false,
          stale: false,
          direction: "positive",
        },
        {
          // index 2 — second extra: mixed signal
          signalKey,
          label: "Mixed signal",
          status: "mixed_signal",
          confidenceLabel: "Low confidence",
          likelihood: 48,
          confidence: 0.38,
          agreement: 0.5,
          agreementDisplay: "3/6 recent",
          reportCount: 6,
          lastReportedAt: new Date(Date.now() - 1000 * 60 * 60 * 7),
          positiveWeight: 3.2,
          negativeWeight: 2.9,
          explanation: "Reports are split — some users found it available while others could not fill.",
          freshnessNote: "Latest report 7h ago",
          mixedSignal: true,
          sparseData: false,
          stale: false,
          direction: "mixed",
        },
        {
          // index 3 — third extra: higher fill risk
          signalKey,
          label: "Higher fill risk",
          status: "likely_unavailable",
          confidenceLabel: "Low confidence",
          likelihood: 22,
          confidence: 0.44,
          agreement: 0.33,
          agreementDisplay: "1/3 recent",
          reportCount: 4,
          lastReportedAt: new Date(Date.now() - 1000 * 60 * 60 * 14),
          positiveWeight: 1.0,
          negativeWeight: 3.8,
          explanation: "Recent contributors were mostly unable to fill at this location.",
          freshnessNote: "Latest report 14h ago",
          mixedSignal: false,
          sparseData: true,
          stale: false,
          direction: "negative",
        },
      ];

      const preset = DEMO_SIGNAL_PRESETS[Math.min(demoIndex, DEMO_SIGNAL_PRESETS.length - 1)];
      return { ...preset, signalKey };
    }

    return crowdSignals[signalKey];
  }

  return (
    <>
      <section className="px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <div className="site-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <span className="eyebrow-label">Pharmacy results</span>
            <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.4rem]">
              Nearby pharmacies on the left. Medication signal on the right.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              {isDemoMedication
                ? "This page keeps the live nearby lookup and a clearly labeled demo medication profile together, while staying explicit that the medication context is simulated."
                : "This page keeps the live nearby lookup and the FDA-derived medication signal together, while staying explicit that they answer different questions."}
            </p>
          </div>

          <PharmacySearchForm
            initialMedication={query}
            initialLocation={location}
            initialLocationPlaceId={locationPlaceId || undefined}
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
              title="Enter both a medication and a location to load Pharmacy Finder."
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
            <>
              {isDemoMedication ? (
                <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/85 px-5 py-4 text-sm leading-6 text-amber-950">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow-label text-amber-700">Demo medication</span>
                    <span className="rounded-full border border-amber-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                      Simulated
                    </span>
                  </div>
                  <p className="mt-2">
                    {pharmacyData?.medication_profile.demo_note || featuredMatch?.demo_context?.note}
                  </p>
                  <p className="mt-1 text-amber-900/80">
                    {pharmacyData?.medication_profile.simulated_user_count || featuredMatch?.demo_context?.simulated_user_count || 0} seeded demo users are configured for this fictional medication variant. Live pharmacy results stay real, and pharmacy-specific crowd reports remain a separate layer.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <div className="surface-panel rounded-[2rem] p-6 sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="eyebrow-label">Live nearby pharmacies</span>
                      <h2 className="mt-4 text-2xl tracking-tight text-slate-950">
                        {pharmacyData?.location.display_label || pharmacyData?.location.formatted_address || location}
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

                        <div className="mt-5">
                          <CrowdSignalCard
                            medicationQuery={query}
                            medicationContext={pharmacyData?.medication_profile}
                            pharmacy={{
                              name: pharmacyData.recommended.name,
                              address: pharmacyData.recommended.address,
                              placeId: pharmacyData.recommended.place_id,
                              googleMapsUrl: pharmacyData.recommended.google_maps_url,
                            }}
                            summary={getCrowdSignalForPharmacy(pharmacyData.recommended, 0)}
                          />
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          {pharmacyData.recommended.google_maps_url ? (
                            <a
                              href={pharmacyData.recommended.google_maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="action-button-dark text-sm"
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
                            {visibleExtras.map((result, extraIndex) => (
                              <div
                                key={`${result.name}-${result.address}`}
                                className="rounded-[1.4rem] border border-slate-200 bg-white p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-lg tracking-tight text-slate-900">{result.name}</div>
                                    <div className="mt-1 text-sm text-slate-500">{result.address}</div>
                                  </div>
                                  <div className="flat-chip">
                                    {formatMiles(result.distance_miles)}
                                  </div>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-600">{result.match_reason}</p>
                                <div className="mt-3">
                                  <CrowdSignalCard
                                    medicationQuery={query}
                                    medicationContext={pharmacyData?.medication_profile}
                                    pharmacy={{
                                      name: result.name,
                                      address: result.address,
                                      placeId: result.place_id,
                                      googleMapsUrl: result.google_maps_url,
                                    }}
                                    summary={getCrowdSignalForPharmacy(result, extraIndex + 1)}
                                    compact
                                  />
                                </div>
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
                        <p className="mt-2">
                          {pharmacyData.guidance.demo_boundary} Community reports sit on top of the
                          live nearby list as a separate, weighted layer rather than as a claim of
                          verified shelf inventory.
                          {pharmacyData.medication_profile.demo_only
                            ? " This medication profile is simulated for the demo and is intentionally separated from FDA-backed medication intelligence."
                            : ""}
                        </p>
                        {!crowdReady ? (
                          <div className="mt-3 flex items-center gap-2 text-slate-500">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Loading crowd signal...
                          </div>
                        ) : null}
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
                  <>
                    <ShortagePanel match={featuredMatch} drugData={drugData!} query={query} location={location} />
                    <div className="surface-panel rounded-[2rem] p-6">
                      <span className="eyebrow-label">Questions to ask next</span>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                          href={`/prescriber?query=${encodeURIComponent(query)}&id=${encodeURIComponent(featuredMatch.id)}&location=${encodeURIComponent(location)}`}
                          className="action-button-dark text-sm"
                        >
                          Open Medication Lookup
                        </Link>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    eyebrow="No FDA match"
                    title={`No shortage data found for "${query}".`}
                    body="No active shortage records matched this medication in the FDA database. Try simplifying the medication name."
                  />
                )}
              </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
