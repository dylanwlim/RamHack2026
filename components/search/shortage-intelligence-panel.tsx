"use client";

import { useState } from "react";
import {
  formatDisplayDate,
  formatRecallClassification,
} from "@/components/search/shared";
import type { DrugIntelligenceResponse } from "@/lib/pharmapath-client";

type Match = DrugIntelligenceResponse["matches"][number];
type ShortageItem = Match["evidence"]["shortages"]["items"][number];
type Variant = "patient" | "prescriber";
type MatchSelection = {
  preferredId?: string | null;
  featuredId?: string | null;
};
type SeverityBand = {
  label: string;
  summary: string;
  textClass: string;
  panelClass: string;
  borderClass: string;
  badgeClass: string;
};
type DoseAvailabilityRow = {
  label: string;
  availableCount: number;
  totalCount: number;
  availabilityPercent: number;
};
type ManufacturerStatusRow = {
  name: string;
  status: string;
  statusLabel: string;
  statusTextClass: string;
  statusDotClass: string;
  strengths: string[];
  lastUpdate: string | null;
};
type ShortageSnapshot = {
  score: number;
  band: SeverityBand;
  activeItems: ShortageItem[];
  durationDays: number;
  lastUpdateLabel: string;
  primaryReason: string | null;
  doseAvailability: DoseAvailabilityRow[];
  manufacturerRows: ManufacturerStatusRow[];
};

const STATUS_PRIORITY: Record<string, number> = {
  active: 4,
  shortage: 3,
  available: 2,
  producing: 1,
  resolved: 0,
  discontinued: -1,
};

const INSIGHT_TONES: Record<
  string,
  { icon: string; iconClass: string }
> = {
  action: {
    icon: "→",
    iconClass: "bg-sky-100 text-sky-700",
  },
  caution: {
    icon: "!",
    iconClass: "bg-rose-100 text-rose-700",
  },
  timing: {
    icon: "◷",
    iconClass: "bg-amber-100 text-amber-700",
  },
  opportunity: {
    icon: "✓",
    iconClass: "bg-emerald-100 text-emerald-700",
  },
};

function normalizeShortageStatus(item: ShortageItem) {
  return item.normalizedStatus ?? item.status?.trim().toLowerCase() ?? "";
}

function isProducingStatus(status: string) {
  return status === "available" || status === "producing";
}

function formatDuration(days: number) {
  if (!days) {
    return "No active clock";
  }

  if (days < 30) {
    return `${days}d`;
  }

  if (days < 365) {
    return `${Math.round(days / 30)} mo`;
  }

  return `${(days / 365).toFixed(1)} yr`;
}

function parseStrengthLabel(value?: string | null) {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?)/i);

  if (match) {
    return `${match[1]} ${match[2].toLowerCase()}`;
  }

  return value?.trim().slice(0, 28) ?? null;
}

function buildSeverityBand(score: number, isDemoMatch: boolean): SeverityBand {
  if (isDemoMatch) {
    return {
      label: "Demo context",
      summary: "Isolated fictional medication data for the public demo route.",
      textClass: "text-amber-900",
      panelClass: "bg-amber-50",
      borderClass: "border-amber-200",
      badgeClass: "border-amber-200 bg-amber-100 text-amber-900",
    };
  }

  if (score <= 15) {
    return {
      label: "Usually fillable",
      summary: "Current reference records do not show much national shortage pressure.",
      textClass: "text-emerald-800",
      panelClass: "bg-emerald-50",
      borderClass: "border-emerald-200",
      badgeClass: "border-emerald-200 bg-white/86 text-emerald-900",
    };
  }

  if (score <= 35) {
    return {
      label: "Some friction",
      summary: "Supply pressure is visible, so expect more checking across strengths or stores.",
      textClass: "text-amber-800",
      panelClass: "bg-amber-50",
      borderClass: "border-amber-200",
      badgeClass: "border-amber-200 bg-white/86 text-amber-900",
    };
  }

  if (score <= 65) {
    return {
      label: "Hard to fill",
      summary: "Multiple shortage clues point to real friction. Alternatives may matter sooner.",
      textClass: "text-orange-800",
      panelClass: "bg-orange-50",
      borderClass: "border-orange-200",
      badgeClass: "border-orange-200 bg-white/86 text-orange-900",
    };
  }

  return {
    label: "Severe shortage",
    summary: "The public record points to broad supply strain across the matched product family.",
    textClass: "text-rose-800",
    panelClass: "bg-rose-50",
    borderClass: "border-rose-200",
    badgeClass: "border-rose-200 bg-white/86 text-rose-900",
  };
}

function measureShortageSnapshot(
  items: ShortageItem[],
  isDemoMatch: boolean,
  referenceTime: number,
): ShortageSnapshot {
  const activeItems = items.filter((item) => normalizeShortageStatus(item) === "active");
  const producingCount = items.filter((item) => isProducingStatus(normalizeShortageStatus(item))).length;
  const firstActiveAt = activeItems
    .map((item) => (item.updateDate ? new Date(item.updateDate).getTime() : null))
    .filter((value): value is number => Number.isFinite(value))
    .sort((left, right) => left - right)[0];
  const durationDays = firstActiveAt
    ? Math.max(0, Math.floor((referenceTime - firstActiveAt) / 86_400_000))
    : 0;
  const supplyPenalty = items.length ? (1 - producingCount / items.length) * 54 : 0;
  const durationPenalty = Math.min(durationDays / 240, 1) * 20;
  const volumePenalty = Math.min(activeItems.length, 5) * 5;
  const score = Math.min(100, Math.round(supplyPenalty + durationPenalty + volumePenalty));
  const lastUpdateLabel =
    activeItems.find((item) => item.updateLabel)?.updateLabel ??
    items.find((item) => item.updateLabel)?.updateLabel ??
    "Unavailable";
  const primaryReason =
    activeItems.map((item) => item.shortageReason?.trim()).find(Boolean) ?? null;
  const doseAvailabilityMap = new Map<string, { availableCount: number; totalCount: number }>();
  const manufacturerMap = new Map<string, ManufacturerStatusRow>();

  items.forEach((item) => {
    const status = normalizeShortageStatus(item);
    const strengthLabel = parseStrengthLabel(item.presentation);

    if (strengthLabel) {
      const current = doseAvailabilityMap.get(strengthLabel) ?? {
        availableCount: 0,
        totalCount: 0,
      };
      current.totalCount += 1;
      if (isProducingStatus(status)) {
        current.availableCount += 1;
      }
      doseAvailabilityMap.set(strengthLabel, current);
    }

    if (!item.companyName) {
      return;
    }

    const existing = manufacturerMap.get(item.companyName) ?? {
      name: item.companyName,
      status,
      statusLabel: "Status pending",
      statusTextClass: "text-slate-500",
      statusDotClass: "bg-slate-400",
      strengths: [],
      lastUpdate: item.updateLabel ?? null,
    };

    if (
      (STATUS_PRIORITY[status] ?? -1) > (STATUS_PRIORITY[existing.status] ?? -1)
    ) {
      existing.status = status;
    }

    if (strengthLabel && !existing.strengths.includes(strengthLabel)) {
      existing.strengths.push(strengthLabel);
    }

    if (!existing.lastUpdate && item.updateLabel) {
      existing.lastUpdate = item.updateLabel;
    }

    manufacturerMap.set(item.companyName, existing);
  });

  const doseAvailability = Array.from(doseAvailabilityMap.entries())
    .map(([label, counts]) => ({
      label,
      availableCount: counts.availableCount,
      totalCount: counts.totalCount,
      availabilityPercent: counts.totalCount
        ? Math.round((counts.availableCount / counts.totalCount) * 100)
        : 0,
    }))
    .sort((left, right) => {
      return (
        right.availabilityPercent - left.availabilityPercent ||
        left.label.localeCompare(right.label, undefined, { numeric: true })
      );
    });

  const manufacturerRows = Array.from(manufacturerMap.values())
    .map((row) => {
      let statusLabel = "Inactive";
      let statusTextClass = "text-slate-500";
      let statusDotClass = "bg-slate-400";

      if (row.status === "active" || row.status === "shortage") {
        statusLabel = "In shortage";
        statusTextClass = "text-rose-700";
        statusDotClass = "bg-rose-500";
      } else if (isProducingStatus(row.status)) {
        statusLabel = "Producing";
        statusTextClass = "text-emerald-700";
        statusDotClass = "bg-emerald-500";
      } else if (row.status === "resolved") {
        statusLabel = "Resolved";
        statusTextClass = "text-sky-700";
        statusDotClass = "bg-sky-500";
      }

      return {
        ...row,
        statusLabel,
        statusTextClass,
        statusDotClass,
        strengths: row.strengths.sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true }),
        ),
      };
    })
    .sort((left, right) => {
      return (
        (STATUS_PRIORITY[right.status] ?? -1) - (STATUS_PRIORITY[left.status] ?? -1) ||
        left.name.localeCompare(right.name)
      );
    });

  return {
    score,
    band: buildSeverityBand(score, isDemoMatch),
    activeItems,
    durationDays,
    lastUpdateLabel,
    primaryReason,
    doseAvailability,
    manufacturerRows,
  };
}

function classifyPatientInsight(text: string) {
  if (/ask|call|confirm|check|request/i.test(text)) {
    return INSIGHT_TONES.action;
  }

  if (/demand|quota|delay|timing|schedule/i.test(text)) {
    return INSIGHT_TONES.timing;
  }

  if (/alternative|backup|switch|spread/i.test(text)) {
    return INSIGHT_TONES.opportunity;
  }

  return INSIGHT_TONES.caution;
}

function buildFreshnessLabel(
  dataFreshness: DrugIntelligenceResponse["data_freshness"],
  isDemoMatch: boolean,
) {
  if (isDemoMatch) {
    return "Isolated demo medication context only.";
  }

  const shortageDate = formatDisplayDate(dataFreshness.shortages_last_updated);
  const recallDate = formatDisplayDate(dataFreshness.recalls_last_updated);

  return `Shortages refreshed ${shortageDate} · Recalls refreshed ${recallDate}`;
}

function meterMarkerStyle(score: number) {
  if (score <= 0) {
    return {
      left: "0%",
      transform: "translate(0, -50%)",
    };
  }

  if (score >= 100) {
    return {
      left: "100%",
      transform: "translate(-100%, -50%)",
    };
  }

  return {
    left: `${score}%`,
    transform: "translate(-50%, -50%)",
  };
}

function AccessMeter({ score }: { score: number }) {
  const markerStyle = meterMarkerStyle(score);

  return (
    <div className="mt-3">
      <div className="relative overflow-visible rounded-full">
        <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" />
        <span
          className="absolute top-1/2 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-950 shadow-[0_6px_14px_rgba(15,23,42,0.18)]"
          style={markerStyle}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">
        <span className="pr-3">Lower friction</span>
        <span className="pl-3 text-right">Higher friction</span>
      </div>
    </div>
  );
}

function DoseAvailabilityCard({ rows }: { rows: DoseAvailabilityRow[] }) {
  if (!rows.length) {
    return null;
  }

  return (
    <div className="surface-panel rounded-[1.45rem] p-4 sm:p-5">
      <span className="eyebrow-label">Dose coverage</span>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {rows.slice(0, 4).map((row) => {
          const toneClass =
            row.availabilityPercent === 100
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : row.availabilityPercent >= 50
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-rose-200 bg-rose-50 text-rose-900";

          return (
            <div
              key={row.label}
              className={`rounded-[0.95rem] border px-3 py-2.5 ${toneClass}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{row.label}</span>
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
                  {row.availabilityPercent}%
                </span>
              </div>
              <p className="mt-1 text-[0.72rem] leading-5 opacity-80">
                {row.availableCount} producing / {row.totalCount} total matching entries
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ManufacturerStatusCard({ rows }: { rows: ManufacturerStatusRow[] }) {
  const [showAll, setShowAll] = useState(false);

  if (!rows.length) {
    return null;
  }

  const visibleRows = showAll ? rows : rows.slice(0, 5);
  const hiddenCount = rows.length - visibleRows.length;

  return (
    <div className="surface-panel rounded-[1.45rem] p-4 sm:p-5">
      <span className="eyebrow-label">Manufacturer status</span>
      <div className="mt-3 divide-y divide-slate-100">
        {visibleRows.map((row) => (
          <div key={row.name} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${row.statusDotClass}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-950">{row.name}</h3>
                {row.lastUpdate ? (
                  <span className="text-[0.64rem] uppercase tracking-[0.16em] text-slate-400">
                    {row.lastUpdate}
                  </span>
                ) : null}
              </div>
              {row.strengths.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {row.strengths.map((strength) => (
                    <span
                      key={`${row.name}-${strength}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.64rem] text-slate-600"
                    >
                      {strength}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <span className={`text-[0.66rem] font-semibold uppercase tracking-[0.16em] ${row.statusTextClass}`}>
              {row.statusLabel}
            </span>
          </div>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="mt-3 text-sm font-medium text-[#156d95]"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Show fewer" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  );
}

function RecallActivityCard({
  items,
}: {
  items: Match["evidence"]["recalls"]["items"];
}) {
  const [showAll, setShowAll] = useState(false);

  if (!items.length) {
    return null;
  }

  return (
    <div className="surface-panel rounded-[1.45rem] p-4 sm:p-5">
      <span className="eyebrow-label">Recent recall activity</span>
      <div className="mt-3 space-y-2.5">
        {(showAll ? items : items.slice(0, 3)).map((recall, index) => {
          const classification = formatRecallClassification(recall.classification);
          const preview = recall.reason?.trim() || "No public recall reason was provided.";

          return (
            <details
              key={`${recall.productDescription ?? "recall"}-${index}`}
              className="group rounded-[1rem] border border-slate-200 bg-white/92"
            >
              <summary className="cursor-pointer list-none px-3.5 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {recall.productDescription ? (
                      <div className="line-clamp-2 text-sm font-semibold leading-6 text-slate-950">
                        {recall.productDescription}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
                      {classification ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
                          {classification}
                        </span>
                      ) : null}
                      {recall.reportDateLabel ? <span>{recall.reportDateLabel}</span> : null}
                      {recall.recallingFirm ? <span>{recall.recallingFirm}</span> : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {preview}
                    </p>
                  </div>
                  <span className="text-[0.72rem] font-medium text-[#156d95]">
                    Details
                  </span>
                </div>
              </summary>
              <div className="border-t border-slate-100 px-3.5 py-3 text-sm leading-6 text-slate-700">
                <p>{preview}</p>
                {recall.status ? (
                  <p className="mt-2 text-[0.82rem] text-slate-500">
                    Status: {recall.status}
                  </p>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
      {items.length > 3 ? (
        <button
          type="button"
          className="mt-3 text-sm font-medium text-[#156d95]"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Show fewer" : `Show ${items.length - 3} more`}
        </button>
      ) : null}
    </div>
  );
}

function PatientMeaningCard({ items }: { items: string[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="surface-panel rounded-[1.45rem] p-4 sm:p-5">
      <span className="eyebrow-label">What this means for you</span>
      <div className="mt-3 divide-y divide-slate-100">
        {items.map((item) => {
          const tone = classifyPatientInsight(item);

          return (
            <div key={item} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.66rem] font-semibold ${tone.iconClass}`}
                aria-hidden
              >
                {tone.icon}
              </span>
              <p className="text-sm leading-6 text-slate-700">{item}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActiveShortageEntriesCard({ items }: { items: ShortageItem[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="surface-panel rounded-[1.7rem] p-5">
      <span className="eyebrow-label">Active shortage entries</span>
      <div className="mt-4 space-y-2.5">
        {items.slice(0, 6).map((item, index) => (
          <div
            key={`${item.companyName ?? "shortage"}-${item.presentation ?? index}`}
            className="rounded-[1.05rem] border border-rose-200 bg-rose-50 p-3.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">
                  {item.presentation || "Matching presentation"}
                </div>
                {item.companyName ? (
                  <div className="mt-1 text-xs text-slate-500">{item.companyName}</div>
                ) : null}
              </div>
              {item.updateLabel ? (
                <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  {item.updateLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-2.5 space-y-2 text-sm leading-6 text-slate-700">
              {item.shortageReason ? (
                <p>
                  <span className="font-semibold text-slate-900">Reason:</span> {item.shortageReason}
                </p>
              ) : null}
              {item.availability ? (
                <p>
                  <span className="font-semibold text-slate-900">Status:</span> {item.availability}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotFooter({
  isDemoMatch,
  variant,
  note,
}: {
  isDemoMatch: boolean;
  variant: Variant;
  note: string | null | undefined;
}) {
  if (isDemoMatch) {
    return (
      <div className="rounded-[1.1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-[0.74rem] leading-5 text-amber-950">
        <strong>Demo medication context only.</strong> {note || "This isolated fictional medication data stays separate from the live catalog."}
      </div>
    );
  }

  const body =
    variant === "patient"
      ? "This medication view uses public shortage and recall records to guide the next pharmacy conversation. It does not confirm local stock."
      : "This medication view uses public shortage, recall, and listing records to support planning. Local inventory, wholesaler allocation, and payer constraints still need separate verification.";

  return (
    <div className="rounded-[1.1rem] border border-slate-200 bg-white/72 px-4 py-3 text-[0.78rem] leading-6 text-slate-600">
      {body}
    </div>
  );
}

function buildIntelligenceContext({
  match,
  dataFreshness,
  selectedMedicationLabel,
  selectedStrength,
  referenceTime,
}: {
  match: Match;
  dataFreshness: DrugIntelligenceResponse["data_freshness"];
  selectedMedicationLabel?: string | null;
  selectedStrength?: string | null;
  referenceTime: number;
}) {
  const isDemoMatch = Boolean(match.demo_context?.demo_only);
  const snapshot = measureShortageSnapshot(
    match.evidence.shortages.items,
    isDemoMatch,
    referenceTime,
  );
  const normalizedSelectedLabel = selectedMedicationLabel?.trim().toLowerCase() || "";
  const selectedContextLabel = [selectedMedicationLabel?.trim(), selectedStrength?.trim()]
    .filter(Boolean)
    .join(" • ");
  const showMatchedFamilyLabel =
    Boolean(normalizedSelectedLabel) &&
    normalizedSelectedLabel !== match.display_name.trim().toLowerCase();
  const familyContextNote = selectedStrength
    ? "Dose and manufacturer rows summarize the matched product family around the selected presentation. They can include sibling strengths in the same formulation."
    : "This snapshot reflects the top matched medication family for the current search, not a live local inventory readout.";

  return {
    isDemoMatch,
    snapshot,
    selectedContextLabel,
    showMatchedFamilyLabel,
    familyContextNote,
    freshnessLabel: buildFreshnessLabel(dataFreshness, isDemoMatch),
  };
}

function SnapshotStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[0.95rem] border border-white/75 bg-white/74 px-3 py-2.5">
      <div className="text-[0.64rem] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-[0.96rem] font-semibold leading-5 text-slate-900">
        {value}
      </div>
    </div>
  );
}

export function MedicationAccessSnapshotCard({
  match,
  dataFreshness,
  variant,
  selectedMedicationLabel,
  selectedStrength,
}: {
  match: Match;
  dataFreshness: DrugIntelligenceResponse["data_freshness"];
  variant: Variant;
  selectedMedicationLabel?: string | null;
  selectedStrength?: string | null;
}) {
  const [referenceTime] = useState(() => Date.now());
  const context = buildIntelligenceContext({
    match,
    dataFreshness,
    selectedMedicationLabel,
    selectedStrength,
    referenceTime,
  });
  const metaItems = [
    {
      label: "active shortage entries",
      value: String(context.snapshot.activeItems.length),
    },
    {
      label: "running duration",
      value: formatDuration(context.snapshot.durationDays),
    },
    {
      label: "latest update",
      value: context.snapshot.lastUpdateLabel,
    },
  ];

  return (
    <div
      className={`surface-panel rounded-[1.55rem] border p-4 sm:p-5 ${context.snapshot.band.panelClass} ${context.snapshot.band.borderClass}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow-label">
          {variant === "patient"
            ? "Medication access snapshot"
            : "Medication evidence snapshot"}
        </span>
        {context.isDemoMatch ? (
          <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900">
            Demo
          </span>
        ) : null}
      </div>

      <div className="mt-3 rounded-[0.95rem] border border-white/70 bg-white/72 px-3.5 py-3">
        <div className="text-[0.64rem] uppercase tracking-[0.16em] text-slate-500">
          Context shown
        </div>
        <div className="mt-1 text-[0.98rem] font-semibold tracking-tight text-slate-950">
          {context.selectedContextLabel || match.display_name}
        </div>
        {context.showMatchedFamilyLabel ? (
          <div className="mt-1 text-[0.72rem] uppercase tracking-[0.16em] text-slate-500">
            Matched family: {match.display_name}
          </div>
        ) : null}
        <p className="mt-1 text-[0.76rem] leading-5 text-slate-600">
          {context.familyContextNote}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[1.45rem] font-bold tracking-tight ${context.snapshot.band.textClass}`}>
            {context.snapshot.band.label}
          </div>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-700">
            {context.snapshot.band.summary}
          </p>
        </div>
        <div
          className={`rounded-full border px-3 py-1 text-[0.92rem] font-semibold tabular-nums ${context.snapshot.band.badgeClass}`}
        >
          {context.snapshot.score}/100
        </div>
      </div>

      <AccessMeter score={context.snapshot.score} />

      <div className="mt-3.5 grid gap-2 sm:grid-cols-3">
        {metaItems.map((item) => (
          <SnapshotStat key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      {context.snapshot.primaryReason ? (
        <div className="mt-3 rounded-[0.95rem] border border-white/70 bg-white/72 px-3.5 py-2.5">
          <div className="text-[0.64rem] uppercase tracking-[0.16em] text-slate-500">
            Shortage driver
          </div>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-900">
            {context.snapshot.primaryReason}
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
        {context.freshnessLabel}
      </p>
    </div>
  );
}

export function MedicationContextDetails({
  match,
  dataFreshness,
  variant,
  selectedMedicationLabel,
  selectedStrength,
}: {
  match: Match;
  dataFreshness: DrugIntelligenceResponse["data_freshness"];
  variant: Variant;
  selectedMedicationLabel?: string | null;
  selectedStrength?: string | null;
}) {
  const [referenceTime] = useState(() => Date.now());
  const context = buildIntelligenceContext({
    match,
    dataFreshness,
    selectedMedicationLabel,
    selectedStrength,
    referenceTime,
  });

  return (
    <div className="space-y-4">
      {variant === "patient" ? (
        <PatientMeaningCard items={match.patient_view.what_may_make_it_harder} />
      ) : (
        <ActiveShortageEntriesCard items={context.snapshot.activeItems} />
      )}

      {context.snapshot.doseAvailability.length || context.snapshot.manufacturerRows.length ? (
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          {context.snapshot.doseAvailability.length ? (
            <DoseAvailabilityCard rows={context.snapshot.doseAvailability} />
          ) : null}
          {context.snapshot.manufacturerRows.length ? (
            <ManufacturerStatusCard rows={context.snapshot.manufacturerRows} />
          ) : null}
        </div>
      ) : null}

      <RecallActivityCard items={match.evidence.recalls.items} />
      <SnapshotFooter
        isDemoMatch={context.isDemoMatch}
        variant={variant}
        note={match.demo_context?.note}
      />
    </div>
  );
}

export function selectMedicationMatch(
  matches: Match[] | null | undefined,
  selection: MatchSelection = {},
) {
  if (!matches?.length) {
    return null;
  }

  const pinnedId = selection.preferredId?.trim();
  if (pinnedId) {
    const pinned = matches.find((match) => match.id === pinnedId);
    if (pinned) {
      return pinned;
    }
  }

  const featuredId = selection.featuredId?.trim();
  if (featuredId) {
    const featured = matches.find((match) => match.id === featuredId);
    if (featured) {
      return featured;
    }
  }

  return matches.reduce((best, candidate) => {
    const bestShortages = best.evidence.shortages.active_count ?? 0;
    const candidateShortages = candidate.evidence.shortages.active_count ?? 0;

    if (candidateShortages !== bestShortages) {
      return candidateShortages > bestShortages ? candidate : best;
    }

    const bestListings = best.active_listing_count ?? 0;
    const candidateListings = candidate.active_listing_count ?? 0;

    return candidateListings > bestListings ? candidate : best;
  }, matches[0]);
}

export function ShortageIntelligencePanel({
  match,
  dataFreshness,
  variant,
  selectedMedicationLabel,
  selectedStrength,
}: {
  match: Match;
  dataFreshness: DrugIntelligenceResponse["data_freshness"];
  variant: Variant;
  selectedMedicationLabel?: string | null;
  selectedStrength?: string | null;
}) {
  return (
    <>
      <MedicationAccessSnapshotCard
        match={match}
        dataFreshness={dataFreshness}
        variant={variant}
        selectedMedicationLabel={selectedMedicationLabel}
        selectedStrength={selectedStrength}
      />
      <MedicationContextDetails
        match={match}
        dataFreshness={dataFreshness}
        variant={variant}
        selectedMedicationLabel={selectedMedicationLabel}
        selectedStrength={selectedStrength}
      />
    </>
  );
}
