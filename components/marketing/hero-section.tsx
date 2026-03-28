import Link from "next/link";
import { ArrowRight, MapPin, ShieldCheck, Stethoscope } from "lucide-react";
import { featuredSearches } from "@/lib/content";

function buildSearchHref(medication: string, location: string) {
  const params = new URLSearchParams({
    query: medication,
    location,
    radiusMiles: "5",
    sortBy: "best_match",
    onlyOpenNow: "false",
  });

  return `/patient/results?${params.toString()}`;
}

export function HeroSection() {
  return (
    <section className="w-full px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pt-32">
      <div className="site-shell">
        <div className="grid grid-cols-12 gap-3">
          <div className="surface-panel col-span-12 flex min-h-[34rem] flex-col justify-between rounded-[2.5rem] bg-[#e8ebee] p-8 sm:p-10 lg:col-span-6 lg:p-14">
            <div>
              <span className="eyebrow-label">Live nearby lookup + FDA signal routing</span>
              <h1 className="mt-6 max-w-[12ch] text-[3rem] leading-[0.96] tracking-tight text-slate-950 sm:text-[4rem]">
                Find the closest pharmacy worth calling first.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-700">
                PharmaPath keeps the nearby pharmacy search live, layers openFDA access signals on
                top, and makes the boundary explicit: inventory still needs a direct confirmation
                call.
              </p>
            </div>

            <div className="mt-10">
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/patient"
                  className="rounded-full bg-[#156d95] px-[18px] py-[15px] text-sm font-medium leading-4 text-white transition-all duration-200 hover:rounded-2xl hover:bg-[#12597a]"
                >
                  Start patient search
                </Link>
                <Link
                  href="/prescriber"
                  className="rounded-full border border-slate-300 px-[18px] py-[15px] text-sm font-medium leading-4 text-slate-900 transition-all duration-200 hover:rounded-2xl hover:border-slate-900"
                >
                  Open prescriber view
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {featuredSearches.slice(0, 3).map((search) => (
                  <Link
                    key={search.id}
                    href={buildSearchHref(search.medication, search.location)}
                    className="rounded-full border border-white/70 bg-white/85 px-3 py-2 text-sm text-slate-700 transition hover:border-[#156d95] hover:text-[#156d95]"
                  >
                    {search.medication} in {search.location}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="surface-panel relative col-span-12 overflow-hidden rounded-[2.5rem] bg-[radial-gradient(circle_at_top_left,_rgba(57,150,211,0.28),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#f4f8fb_100%)] p-8 sm:p-10 lg:col-span-6 lg:p-12">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(111,196,185,0.25),_transparent_58%)]" />
            <div className="relative flex h-full min-h-[34rem] flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Demo workflow
                  </p>
                  <h2 className="mt-2 text-3xl tracking-tight text-slate-950">
                    One search, three truths.
                  </h2>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-slate-500">
                  Trust the boundary
                </div>
              </div>

              <div className="mt-10 grid gap-4">
                <div className="ml-auto max-w-[18rem] rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-[#156d95]" />
                    <div>
                      <p className="text-sm text-slate-500">Nearby list</p>
                      <p className="text-lg font-medium text-slate-950">Google Places live</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Real pharmacy names, distance, hours, ratings, and Maps links.
                  </p>
                </div>

                <div className="max-w-[19rem] rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="h-5 w-5 text-sky-300" />
                    <div>
                      <p className="text-sm text-slate-300">Medication signal</p>
                      <p className="text-lg font-medium">openFDA-derived access summary</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    Shortages, approvals, manufacturer breadth, and recalls get translated into a
                    careful access signal.
                  </p>
                </div>

                <div className="ml-10 max-w-[20rem] rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5 shadow-[0_18px_48px_rgba(16,185,129,0.08)]">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    <div>
                      <p className="text-sm text-emerald-700/70">Always say this</p>
                      <p className="text-lg font-medium text-emerald-900">Call to confirm stock</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-emerald-900/80">
                    Nearby discovery is live. Inventory confirmation is still manual.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-white px-3 py-2">No fake inventory claim</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <span className="rounded-full bg-white px-3 py-2">Route the right next call</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
