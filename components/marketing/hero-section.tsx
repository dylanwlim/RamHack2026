"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, ShieldCheck, Stethoscope } from "lucide-react";
import { featuredSearches } from "@/lib/content";
import { motionEase, motionTiming } from "@/lib/motion";
import { openSurfaceLabels } from "@/lib/surface-labels";

const workflowBubbles = [
  {
    id: "nearby",
    eyebrow: "Nearby pharmacies",
    title: "Live nearby search",
    description:
      "Pharmacy names, distance, hours, ratings, and Maps links.",
    icon: MapPin,
    alignmentClassName: "self-end",
    surfaceClassName:
      "border border-black/5 bg-white/88 text-[#202020] shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl",
    iconClassName: "text-[#156d95]",
    eyebrowClassName: "text-slate-500",
    titleClassName: "text-[#202020]",
    descriptionClassName: "text-slate-600",
  },
  {
    id: "context",
    eyebrow: "Medication context",
    title: "Reference-based access info",
    description:
      "Shortages, formulation breadth, manufacturer spread, and recall context in plain language.",
    icon: Stethoscope,
    alignmentClassName: "self-start",
    surfaceClassName:
      "border border-slate-900/10 bg-slate-950 text-white shadow-[0_8px_32px_rgba(15,23,42,0.16)]",
    iconClassName: "text-sky-300",
    eyebrowClassName: "text-slate-300",
    titleClassName: "text-white",
    descriptionClassName: "text-slate-300",
  },
  {
    id: "always",
    eyebrow: "Always",
    title: "Call to confirm stock",
    description:
      "Nearby discovery is live. Inventory confirmation is still manual.",
    icon: ShieldCheck,
    alignmentClassName: "self-center",
    surfaceClassName:
      "border border-emerald-200/60 bg-emerald-50/92 text-emerald-950 shadow-[0_8px_32px_rgba(16,185,129,0.08)]",
    iconClassName: "text-emerald-700",
    eyebrowClassName: "text-emerald-700/70",
    titleClassName: "text-emerald-900",
    descriptionClassName: "text-emerald-900/80",
  },
] as const;

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
    <section className="w-full px-4 pb-10 pt-[calc(var(--navbar-height)+1.5rem)] sm:px-6 lg:px-8 lg:pb-12 lg:pt-[calc(var(--navbar-height)+1.5rem)]">
      <div className="site-shell">
        <div className="grid grid-cols-12 gap-3 lg:gap-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: motionTiming.hero,
              ease: motionEase.emphasis,
            }}
            className="surface-panel col-span-12 rounded-[2.5rem] bg-[#e9e9e9] px-8 py-8 sm:px-10 sm:py-9 lg:col-span-6 lg:px-10 lg:py-8 xl:px-11 xl:py-9"
          >
            <div className="flex h-full min-h-[28rem] flex-col gap-6 lg:min-h-[29rem] lg:gap-6">
              <div className="max-w-[31rem]">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: motionEase.emphasis,
                    delay: 0.6,
                  }}
                >
                  <Link
                    href="/patient"
                    className="eyebrow-label eyebrow-link gap-1 text-slate-500"
                  >
                    Nearby search + medication context
                    <ArrowRight className="h-[0.72em] w-[0.72em]" />
                  </Link>
                </motion.div>
                <h1 className="mt-4 max-w-[11.35ch] text-balance text-[2.95rem] leading-[0.97] tracking-tight text-[#202020] sm:text-[3.25rem] sm:leading-[0.98] lg:text-[3.45rem] xl:text-[3.65rem]">
                  Find the closest pharmacy worth calling first.
                </h1>
                <p className="mt-4 max-w-[29rem] text-[1.02rem] leading-[1.9rem] text-[#404040]">
                  PharmaPath finds nearby pharmacies, adds medication access
                  context, and stays explicit about what it can and can&apos;t
                  confirm.
                </p>
              </div>

              <div className="mt-auto flex flex-col gap-4">
                <div className="flex flex-wrap gap-3">
                  <Link href="/patient" className="action-button-primary">
                    {openSurfaceLabels.patient}
                  </Link>
                  <Link href="/prescriber" className="action-button-secondary">
                    {openSurfaceLabels.prescriber}
                  </Link>
                </div>

                <div className="flex max-w-[31rem] flex-wrap gap-2">
                  {featuredSearches.slice(0, 3).map((search) => (
                    <Link
                      key={search.id}
                      href={buildSearchHref(search.medication, search.location)}
                      className="flat-chip text-[0.88rem] leading-5 hover:border-[#156d95]/25 hover:text-[#156d95]"
                    >
                      {search.medication} in {search.location}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: motionTiming.hero,
              ease: motionEase.emphasis,
              delay: 0.2,
            }}
            className="surface-panel relative col-span-12 overflow-hidden rounded-[2.5rem] bg-[radial-gradient(circle_at_top_left,_rgba(57,150,211,0.28),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#f4f8fb_100%)] px-8 py-8 sm:px-10 sm:py-9 lg:col-span-6 lg:px-10 lg:py-8 xl:px-11 xl:py-9"
          >
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(111,196,185,0.25),_transparent_58%)]" />
            <div className="relative flex h-full min-h-[28rem] flex-col gap-6 lg:min-h-[29rem] lg:gap-6">
              <div className="max-w-[22rem]">
                <span className="eyebrow-label text-slate-500">
                  How it works
                </span>
                <h2 className="mt-4 max-w-[12.75ch] text-balance text-[2.34rem] font-normal leading-[1] tracking-tight text-[#202020] sm:text-[2.5rem] sm:leading-[1] lg:text-[2.62rem] xl:text-[2.78rem]">
                  One search, clearer{" "}
                  <span className="whitespace-nowrap">next steps.</span>
                </h2>
              </div>

              <div className="mt-auto flex flex-col gap-3 sm:gap-3.5">
                {workflowBubbles.map((bubble, index) => {
                  const Icon = bubble.icon;

                  return (
                    <motion.div
                      key={bubble.id}
                      initial={{ opacity: 0, y: 20, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: motionTiming.reveal,
                        ease: motionEase.card,
                        delay: 0.15 + index * 0.1,
                      }}
                      className={`w-full max-w-[21rem] rounded-[1.5rem] px-5 py-[0.9rem] sm:px-5 sm:py-[0.95rem] lg:min-h-[8.65rem] ${bubble.alignmentClassName} ${bubble.surfaceClassName}`}
                    >
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2.5">
                        <Icon
                          className={`mt-0.5 h-4 w-4 shrink-0 ${bubble.iconClassName}`}
                        />
                        <div className="space-y-0.5">
                          <p
                            className={`text-[0.8rem] leading-5 ${bubble.eyebrowClassName}`}
                          >
                            {bubble.eyebrow}
                          </p>
                          <p
                            className={`text-[1.04rem] font-medium leading-[1.45rem] ${bubble.titleClassName}`}
                          >
                            {bubble.title}
                          </p>
                        </div>
                        <p
                          className={`col-start-2 text-[0.9rem] leading-[1.5rem] ${bubble.descriptionClassName}`}
                        >
                          {bubble.description}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
