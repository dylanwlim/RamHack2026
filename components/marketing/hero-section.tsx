"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, ShieldCheck, Stethoscope } from "lucide-react";
import { featuredSearches } from "@/lib/content";
import { motionEase, motionTiming } from "@/lib/motion";

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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: motionTiming.hero, ease: motionEase.emphasis }}
            className="surface-panel col-span-12 flex min-h-[34rem] flex-col justify-between rounded-[2.5rem] bg-[#e9e9e9] p-8 sm:p-10 lg:col-span-6 lg:p-14"
          >
            <div>
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: motionEase.emphasis, delay: 0.6 }}
                className="eyebrow-label gap-1 text-slate-500"
              >
                Live nearby lookup + FDA signal routing
                <ArrowRight className="h-[0.72em] w-[0.72em]" />
              </motion.span>
              <h1 className="mt-6 max-w-[11ch] text-[3.5rem] leading-[3.75rem] tracking-tight text-[#202020] sm:text-[4rem] sm:leading-[4.15rem]">
                Find the closest pharmacy worth calling first.
              </h1>
              <p className="mt-6 max-w-[32rem] text-lg leading-7 text-[#404040]">
                PharmaPath keeps the nearby pharmacy search live, layers openFDA access signals on
                top, and makes the boundary explicit: inventory still needs a direct confirmation
                call.
              </p>
            </div>

            <div className="mt-10">
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/patient"
                  className="template-button-primary"
                >
                  Start patient search
                </Link>
                <Link
                  href="/prescriber"
                  className="template-button-secondary"
                >
                  Open prescriber view
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {featuredSearches.slice(0, 3).map((search) => (
                  <Link
                    key={search.id}
                    href={buildSearchHref(search.medication, search.location)}
                    className="flat-chip hover:border-[#156d95]/25 hover:text-[#156d95]"
                  >
                    {search.medication} in {search.location}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: motionTiming.hero, ease: motionEase.emphasis, delay: 0.2 }}
            className="surface-panel relative col-span-12 overflow-hidden rounded-[2.5rem] bg-[radial-gradient(circle_at_top_left,_rgba(57,150,211,0.28),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#f4f8fb_100%)] p-8 sm:p-10 lg:col-span-6 lg:p-12"
          >
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(111,196,185,0.25),_transparent_58%)]" />
            <div className="relative flex h-full min-h-[34rem] flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-slate-500">
                    Demo workflow
                  </p>
                  <h2 className="mt-2 text-[2.5rem] font-normal tracking-tight text-[#202020]">
                    One search, three truths.
                  </h2>
                </div>
                <div className="eyebrow-label shrink-0 text-slate-500">
                  Trust the boundary
                </div>
              </div>

              <div className="mt-10 grid gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: motionTiming.reveal, ease: motionEase.card, delay: 0.15 }}
                  className="ml-auto max-w-[18rem] rounded-[1.5rem] border border-black/5 bg-white/88 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-[#156d95]" />
                    <div>
                      <p className="text-sm text-slate-500">Nearby list</p>
                      <p className="text-lg font-medium text-[#202020]">Google Places live</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Real pharmacy names, distance, hours, ratings, and Maps links.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: motionTiming.reveal, ease: motionEase.card, delay: 0.25 }}
                  className="max-w-[19rem] rounded-[1.5rem] border border-slate-900/10 bg-slate-950 p-6 text-white shadow-[0_8px_32px_rgba(15,23,42,0.16)]"
                >
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
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: motionTiming.reveal, ease: motionEase.card, delay: 0.35 }}
                  className="ml-10 max-w-[20rem] rounded-[1.5rem] border border-emerald-200/60 bg-emerald-50/92 p-5 shadow-[0_8px_32px_rgba(16,185,129,0.08)]"
                >
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
                </motion.div>
              </div>

              <div className="mt-8 flex items-center gap-2 text-sm text-slate-600">
                <span className="flat-chip">No fake inventory claim</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <span className="flat-chip">Route the right next call</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
