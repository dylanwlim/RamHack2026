"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, MessageSquarePlus, Send } from "lucide-react";
import { SignedOutContributionPrompt } from "@/components/auth/require-auth";
import { AuthButton } from "@/components/auth/auth-primitives";
import {
  computeCrowdSignal,
} from "@/lib/crowd-signal/scoring";
import {
  CROWD_REPORT_TYPES,
  type CrowdSignalSummary,
  type CrowdReportType,
} from "@/lib/crowd-signal/model";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

function crowdTone(summary: CrowdSignalSummary) {
  switch (summary.status) {
    case "likely_in_stock":
      return "border-emerald-100 bg-emerald-50 text-emerald-800";
    case "likely_unavailable":
      return "border-rose-100 bg-rose-50 text-rose-800";
    case "mixed_signal":
      return "border-amber-100 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.9rem] border border-slate-200 bg-white/90 px-3 py-2">
      <div className="text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

export function CrowdSignalCard({
  medicationQuery,
  medicationContext,
  pharmacy,
  summary,
  compact = false,
}: {
  medicationQuery: string;
  medicationContext?: {
    demo_only?: boolean;
    demo_note?: string | null;
    simulated_user_count?: number | null;
    selected_strength?: string | null;
    formulation?: string | null;
  } | null;
  pharmacy: {
    name: string;
    address: string;
    placeId: string | null;
    googleMapsUrl: string | null;
  };
  summary?: CrowdSignalSummary;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const { firebaseReady, profile, status, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState<CrowdReportType>("in_stock");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDemoMedication = Boolean(medicationContext?.demo_only);

  const resolvedSummary = useMemo(
    () =>
      summary ||
      computeCrowdSignal(
        `${pharmacy.placeId || pharmacy.name}-${pharmacy.address}`,
        [],
      ),
    [pharmacy.address, pharmacy.name, pharmacy.placeId, summary],
  );
  const likelihoodDisplay = resolvedSummary.reportCount ? `${resolvedSummary.likelihood}%` : "No data";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setError("Sign in before submitting a crowd report.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setFeedback(null);

      const { submitCrowdReport } = await import("@/lib/crowd-signal/firestore");
      await submitCrowdReport({
        actor: user,
        profile,
        medicationQuery,
        pharmacyName: pharmacy.name,
        pharmacyAddress: pharmacy.address,
        pharmacyPlaceId: pharmacy.placeId,
        googleMapsUrl: pharmacy.googleMapsUrl,
        reportType,
        note,
      });

      setFeedback("Report submitted. The crowd signal will refresh automatically.");
      setNote("");
      setIsOpen(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to submit the crowd report.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn("rounded-[1.35rem] border border-slate-200 bg-white/92 p-3.5", compact && "p-3")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
            Crowd availability signal
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-3 py-1 text-[0.9rem] font-medium", crowdTone(resolvedSummary))}>
              {resolvedSummary.label}
            </span>
            <span className="text-[0.82rem] text-slate-500">{resolvedSummary.confidenceLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "authenticated" ? (
            <AuthButton
              type="button"
              variant="outline"
              className="h-9 px-3.5 text-sm"
              onClick={() => {
                setFeedback(null);
                setError(null);
                setIsOpen((value) => !value);
              }}
            >
              <MessageSquarePlus className="h-4 w-4" />
              {isOpen ? "Close" : "Add report"}
            </AuthButton>
          ) : null}
        </div>
      </div>

      <p className={cn("mt-2.5 text-sm leading-6 text-slate-600", compact && "text-[0.9rem]")}>
        {resolvedSummary.explanation}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Likelihood" value={likelihoodDisplay} />
        <MiniMetric label={isDemoMedication ? "Live reports" : "Reports"} value={String(resolvedSummary.reportCount)} />
        <MiniMetric label="Freshness" value={resolvedSummary.freshnessNote} />
        <MiniMetric label="Consensus" value={resolvedSummary.agreementDisplay} />
      </div>

      <p className="mt-2.5 text-[0.74rem] leading-5 text-slate-500">
        Crowd reports are weighted by contributor history and recency, and sparse samples stay conservative. Direct pharmacy confirmation is still recommended before sending someone to pick up a prescription.
      </p>

      {isDemoMedication ? (
        <p className="mt-2 text-[0.74rem] leading-5 text-amber-900/85">
          {medicationContext?.demo_note} {medicationContext?.simulated_user_count || 0} seeded demo users are associated with this fictional medication, but pharmacy-specific live report counts remain separate from that simulated context.
        </p>
      ) : null}

      {feedback ? <p className="mt-2.5 text-sm text-emerald-700">{feedback}</p> : null}
      {error ? <p className="mt-2.5 text-sm text-rose-700">{error}</p> : null}

      {status !== "authenticated" && !compact ? (
        <div className="mt-3">
          <SignedOutContributionPrompt nextPath={nextPath} />
        </div>
      ) : null}

      {status !== "authenticated" && compact ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>Want to improve this signal?</span>
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="text-[#156d95]"
          >
            Log in to report
          </Link>
        </div>
      ) : null}

      {isOpen && status === "authenticated" && firebaseReady ? (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3.5 rounded-[1.15rem] border border-slate-200 bg-slate-50/70 p-3.5">
          <div className="grid gap-2 sm:grid-cols-2">
            {CROWD_REPORT_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={cn(
                  "rounded-[0.95rem] border px-3.5 py-3 text-left text-sm transition-all",
                  reportType === type.id
                    ? "border-[#156d95] bg-[#156d95]/8 text-slate-950 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[#156d95]/25 hover:text-slate-900",
                )}
                onClick={() => setReportType(type.id)}
              >
                <div className="font-medium">{type.label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{type.description}</div>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900" htmlFor={`${pharmacy.name}-note`}>
              Notes <span className="font-normal text-slate-500">(optional, max 240 chars)</span>
            </label>
            <textarea
              id={`${pharmacy.name}-note`}
              className="min-h-[84px] w-full rounded-[0.95rem] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus-visible:border-[#156d95] focus-visible:ring-[3px] focus-visible:ring-[#156d95]/12"
              placeholder="Example: Tech said they had two boxes left but recommended calling before driving over."
              maxLength={240}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.74rem] leading-5 text-slate-500">
              Reports are tied to your contribution history, and stale reports decay automatically.
            </p>
            <AuthButton
              type="submit"
              className="h-10 px-4.5"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit report
                </>
              )}
            </AuthButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
