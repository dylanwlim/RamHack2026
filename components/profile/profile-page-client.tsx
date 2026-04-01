"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import {
  Clock3,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import type { CrowdReportRecord } from "@/lib/crowd-signal/model";
import { getTrustTier } from "@/lib/crowd-signal/scoring";
import { useAuth } from "@/lib/auth/auth-context";

function formatDate(value: Date | null) {
  if (!value) {
    return "Unavailable";
  }

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(value: Date | null) {
  if (!value) {
    return "Pending";
  }

  const diffHours = Math.max(
    1,
    Math.round((Date.now() - value.getTime()) / (1000 * 60 * 60)),
  );
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

const recentSearchesEmptyMessage =
  "Recent searches will appear here after you run a signed-in search.";

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  const Icon = icon;

  return (
    <div className="surface-panel rounded-[1.8rem] p-5">
      <div className="flex items-center gap-3 text-slate-500">
        <div className="rounded-full bg-[#156d95]/10 p-2 text-[#156d95]">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="mt-4 text-2xl tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

export function ProfilePageClient() {
  const { user, profile } = useAuth();
  const [contributions, setContributions] = useState<CrowdReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void import("@/lib/crowd-signal/firestore")
      .then(({ listCrowdReportsForUser }) => listCrowdReportsForUser(user.uid))
      .then((items) => {
        if (!cancelled) {
          setContributions(items);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContributions([]);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const trustTier = getTrustTier(profile?.contributionCount || 0);

  return (
    <RequireAuth>
      <section className="px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <div className="site-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <span className="eyebrow-label">Contributor profile</span>
            <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.4rem]">
              Keep your account, trust level, and reporting history in one
              place.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Your influence on the crowd signal grows gradually with
              contribution history, then plateaus so no single user can dominate
              the estimate forever.
            </p>
          </div>

          <div className="surface-panel rounded-[2rem] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                  Account
                </div>
                <h2 className="mt-3 text-2xl tracking-tight text-slate-950">
                  {profile?.displayName ||
                    user?.displayName ||
                    "PharmaPath User"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {profile?.email || user?.email}
                </p>
              </div>
              <Link
                href="/settings"
                className="action-button-secondary text-sm"
              >
                Edit settings
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  Trust tier
                </div>
                <div className="mt-2 text-lg text-slate-950">
                  {trustTier.label}
                </div>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  Default location
                </div>
                <div className="mt-2 text-lg text-slate-950">
                  {profile?.defaultLocationLabel || "Not set yet"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="site-shell space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={UserRound}
              label="Display name"
              value={profile?.displayName || "Unavailable"}
            />
            <MetricCard
              icon={Clock3}
              label="Member since"
              value={formatDate(
                profile?.createdAt ||
                  (user?.metadata.creationTime
                    ? new Date(user.metadata.creationTime)
                    : null),
              )}
            />
            <MetricCard
              icon={Sparkles}
              label="Contributions"
              value={String(
                profile?.contributionCount || contributions.length || 0,
              )}
            />
            <MetricCard
              icon={ShieldCheck}
              label="Trust level"
              value={trustTier.shortLabel}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <div className="surface-panel rounded-[2rem] p-6">
                <span className="eyebrow-label">Profile details</span>
                <div className="mt-5 space-y-4 text-base leading-7 text-slate-700">
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white px-5 py-4">
                    <div className="text-sm uppercase tracking-[0.16em] text-slate-500">
                      Email
                    </div>
                    <div className="mt-2 text-slate-950">
                      {profile?.email || user?.email || "Unavailable"}
                    </div>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white px-5 py-4">
                    <div className="text-sm uppercase tracking-[0.16em] text-slate-500">
                      Location
                    </div>
                    <div className="mt-2 text-slate-950">
                      {[profile?.city, profile?.state]
                        .filter(Boolean)
                        .join(", ") ||
                        profile?.zipCode ||
                        profile?.defaultLocationLabel ||
                        "Not set yet"}
                    </div>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white px-5 py-4">
                    <div className="text-sm uppercase tracking-[0.16em] text-slate-500">
                      Contributor alias
                    </div>
                    <div className="mt-2 text-slate-950">
                      {profile?.publicContributorAlias
                        ? profile?.contributorAlias ||
                          profile?.displayName ||
                          "Public alias enabled"
                        : "Private by default"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="surface-panel rounded-[2rem] p-6">
                <span className="eyebrow-label">Recent searches</span>
                {profile?.recentSearches.length ? (
                  <div className="mt-5 space-y-3">
                    {profile.recentSearches.map((search, index) => (
                      <div
                        key={`${search.medication}-${search.location}-${index}`}
                        className="rounded-[1.4rem] border border-slate-200 bg-white px-5 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg tracking-tight text-slate-950">
                              {search.medication}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                              <MapPin className="h-4 w-4 text-[#156d95]" />
                              {search.location}
                            </div>
                          </div>
                          <div className="flat-chip text-xs text-slate-600">
                            {search.radiusMiles} mi
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 text-base leading-7 text-slate-600">
                    {recentSearchesEmptyMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="surface-panel rounded-[2rem] p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow-label">Contribution history</span>
                <Link href="/patient" className="text-sm text-[#156d95]">
                  Search and report
                </Link>
              </div>

              {isLoading ? (
                <div className="mt-8 flex items-center gap-3 text-slate-500">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Loading contribution history...
                </div>
              ) : contributions.length ? (
                <div className="mt-5 space-y-3">
                  {contributions.slice(0, 12).map((report) => (
                    <div
                      key={report.id}
                      className="rounded-[1.4rem] border border-slate-200 bg-white px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm uppercase tracking-[0.16em] text-slate-500">
                            {report.reportType.replaceAll("_", " ")}
                          </div>
                          <div className="mt-2 text-lg tracking-tight text-slate-950">
                            {report.pharmacyName}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {report.medicationQuery}
                          </p>
                          {report.note ? (
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              “{report.note}”
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right text-sm text-slate-500">
                          <div>{formatRelative(report.createdAt)}</div>
                          <div className="mt-1">
                            {formatDate(report.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-base leading-7 text-slate-600">
                  You have not submitted any crowd reports yet. Once you report
                  a pharmacy result, it will show up here with timing and
                  medication context.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </RequireAuth>
  );
}
