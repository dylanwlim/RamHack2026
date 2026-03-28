"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { workflowShowcase } from "@/lib/content";

export function WorkflowShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = workflowShowcase[activeIndex];

  return (
    <section className="section-space">
      <div className="site-shell">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
          <div>
            <span className="eyebrow-label">Route structure</span>
            <h2 className="mt-6 section-title">Three focused surfaces instead of one noisy dashboard.</h2>
            <p className="mt-4 section-copy">
              The template’s section rhythm is preserved, but the product story is rewritten around
              the actual PharmaPath flow: patient search, prescriber evidence, and methodology.
            </p>

            <div className="mt-8 space-y-3">
              {workflowShowcase.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`w-full rounded-[1.5rem] border px-5 py-4 text-left transition ${
                    index === activeIndex
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="text-sm uppercase tracking-[0.18em] opacity-70">{item.id}</div>
                  <div className="mt-2 text-lg tracking-tight">{item.title}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="surface-panel overflow-hidden rounded-[2.3rem]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`h-full bg-gradient-to-br ${active.accent} p-8 sm:p-10`}
              >
                <div className="max-w-xl">
                  <span className="eyebrow-label border-white/70 bg-white/80">{active.id}</span>
                  <h3 className="mt-6 text-[2.25rem] leading-tight tracking-tight text-slate-950">
                    {active.title}
                  </h3>
                  <p className="mt-5 text-lg leading-8 text-slate-700">{active.summary}</p>
                  <ul className="mt-8 space-y-3">
                    {active.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3 text-sm leading-6 text-slate-700 sm:text-base">
                        <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#156d95]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={active.href}
                    className="mt-8 inline-flex rounded-full bg-slate-950 px-[18px] py-[15px] text-sm font-medium leading-4 text-white transition-all duration-200 hover:rounded-2xl"
                  >
                    Open {active.id} route
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
