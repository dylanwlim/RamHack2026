"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { workflowShowcase } from "@/lib/content";
import { motionEase, motionTiming } from "@/lib/motion";
import { surfaceNames } from "@/lib/surface-labels";

type RouteId = (typeof workflowShowcase)[number]["id"];

const routeVisualMeta: Record<
  RouteId,
  {
    panelTitle: string;
    panelLabel: string;
    sections: Array<{
      title: string;
      value: string;
      detail: string;
    }>;
    footer: string;
    accentColor: string;
  }
> = {
  patient: {
    panelTitle: surfaceNames.patient,
    panelLabel: "Call-ready view",
    sections: [
      {
        title: "Nearby pharmacies",
        value: "Live nearby list",
        detail:
          "Pharmacies, distance, hours, ratings, and map links from a live nearby search.",
      },
      {
        title: "Access info",
        value: "Medication-wide estimate",
        detail:
          "Medication context helps frame the right question without implying that a store already has the medication.",
      },
      {
        title: "Next question",
        value: "Call before assuming",
        detail:
          "Kept short so the user can move from search to a confirmation call quickly.",
      },
    ],
    footer: "",
    accentColor: "#156d95",
  },
  prescriber: {
    panelTitle: surfaceNames.prescriber,
    panelLabel: "Evidence-first view",
    sections: [
      {
        title: "Shortage trail",
        value: "Operational context",
        detail:
          "Shortage, recall, and manufacturer context stays visible for clinical planning instead of being flattened into a single label.",
      },
      {
        title: "Manufacturer spread",
        value: "Breadth matters",
        detail:
          "Formulation and manufacturer context together so backup planning is grounded in actual data.",
      },
      {
        title: "Alternative planning",
        value: "Visible earlier",
        detail:
          "When friction is higher, it's easier to think through alternatives before repeated failed pharmacy calls.",
      },
    ],
    footer: "",
    accentColor: "#159a83",
  },
  methodology: {
    panelTitle: "Methodology",
    panelLabel: "Trust boundary",
    sections: [
      {
        title: "Known vs inferred",
        value: "Boundaries surfaced",
        detail:
          "The app distinguishes what comes directly from the live nearby search from what is inferred or still unknown.",
      },
      {
        title: "Call readiness",
        value: "Next steps visible",
        detail:
          "Each view is designed to shorten the next call instead of overselling certainty.",
      },
      {
        title: "Honest language",
        value: "Truthful positioning",
        detail:
          "Makes the language explicit so the app never overstates what the data can actually guarantee.",
      },
    ],
    footer: "",
    accentColor: "#d97706",
  },
};

function RouteVisualPanel({ routeId }: { routeId: RouteId }) {
  const panel = routeVisualMeta[routeId];

  return (
    <div className="surface-panel flex h-full min-h-[28rem] w-full flex-col justify-center rounded-[2rem] bg-white/94 p-6 shadow-none backdrop-blur-none sm:p-8 lg:min-h-[32rem]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {panel.panelTitle}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            {panel.panelLabel}
          </p>
        </div>
        <span
          className="mt-1 h-2.5 w-2.5 flex-none rounded-full"
          style={{
            backgroundColor: panel.accentColor,
          }}
        />
      </div>

      <div className="mt-6 grid gap-3">
        {panel.sections.map((section) => (
          <div
            key={section.title}
            className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50/70 p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-sm font-semibold text-slate-900">
                {section.title}
              </h4>
              <span className="text-sm font-medium text-slate-500">
                {section.value}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {section.detail}
            </p>
          </div>
        ))}
      </div>

      {panel.footer ? (
        <div className="mt-6 border-t border-slate-200/80 pt-4">
          <p className="text-sm leading-6 text-slate-500">{panel.footer}</p>
        </div>
      ) : null}
    </div>
  );
}

export function WorkflowShowcase() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const active = workflowShowcase[currentIndex];
  const activeMeta = routeVisualMeta[active.id];

  const nextSlide = () => {
    setDirection(1);
    setCurrentIndex((index) => (index + 1) % workflowShowcase.length);
  };

  const prevSlide = () => {
    setDirection(-1);
    setCurrentIndex(
      (index) =>
        (index - 1 + workflowShowcase.length) % workflowShowcase.length,
    );
  };

  const goToSlide = (index: number) => {
    if (index === currentIndex) {
      return;
    }

    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  useEffect(() => {
    if (!isAutoPlaying) {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
      return;
    }

    autoPlayRef.current = setInterval(nextSlide, motionTiming.autoAdvanceMs);

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
  }, [currentIndex, isAutoPlaying]);

  const slideFrameVariants = {
    enter: (slideDirection: number) => ({
      opacity: 0,
      x: slideDirection > 0 ? 32 : -32,
    }),
    center: {
      opacity: 1,
      x: 0,
      transition: {
        duration: motionTiming.base + 0.12,
        ease: motionEase.standard,
        when: "beforeChildren",
        staggerChildren: 0.04,
      },
    },
    exit: (slideDirection: number) => ({
      opacity: 0,
      x: slideDirection < 0 ? 32 : -32,
      transition: {
        duration: motionTiming.base,
        ease: motionEase.standard,
        when: "afterChildren",
      },
    }),
  };

  const slideChildVariants = {
    enter: (slideDirection: number) => ({
      opacity: 0,
      x: slideDirection > 0 ? 18 : -18,
    }),
    center: {
      opacity: 1,
      x: 0,
      transition: {
        duration: motionTiming.base + 0.08,
        ease: motionEase.standard,
      },
    },
    exit: (slideDirection: number) => ({
      opacity: 0,
      x: slideDirection < 0 ? 18 : -18,
      transition: {
        duration: motionTiming.quick + 0.05,
        ease: motionEase.standard,
      },
    }),
  };

  return (
    <section
      className="section-space bg-gradient-to-br from-white via-white to-slate-100/40"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      <div className="site-shell">
        <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-10 lg:min-h-[46rem] lg:justify-center lg:gap-12">
          <div className="mx-auto flex w-full max-w-[43rem] flex-col items-center text-center">
            <span className="eyebrow-label justify-center">Pages</span>
            <h2 className="mt-6 max-w-[30rem] section-title text-center">
              Three surfaces. Three distinct jobs.
            </h2>
            <p className="mt-4 max-w-[40rem] text-lg leading-7 text-slate-600">
              Pharmacy Finder handles the nearby call list, Medication Lookup
              keeps the evidence trail intact, and Methodology marks the
              boundary between direct information and inference.
            </p>
          </div>

          <div className="w-full">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={active.id}
                custom={direction}
                variants={slideFrameVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="grid gap-10 lg:grid-cols-[minmax(0,38rem)_minmax(0,46rem)] lg:items-start lg:justify-center lg:gap-14"
              >
                <motion.div
                  custom={direction}
                  variants={slideChildVariants}
                  className="flex min-h-[26rem] w-full max-w-[38rem] flex-col justify-start space-y-6 lg:min-h-[32rem]"
                >
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {activeMeta.panelTitle}
                  </div>
                  <h3 className="text-[2.25rem] leading-tight tracking-tight text-slate-950">
                    {active.title}
                  </h3>
                  <p className="max-w-[36rem] text-lg leading-8 text-slate-700">
                    {active.summary}
                  </p>
                  <ul className="space-y-3">
                    {active.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-3 text-sm leading-6 text-slate-700 sm:text-base"
                      >
                        <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#156d95]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={active.href} className="action-button-primary">
                    Open {activeMeta.panelTitle}
                  </Link>
                </motion.div>

                <motion.div
                  custom={direction}
                  variants={slideChildVariants}
                  className="relative flex w-full max-w-[46rem] items-start justify-center lg:justify-self-end"
                >
                  <RouteVisualPanel routeId={active.id} />
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex w-full max-w-[38rem] items-center gap-6">
            <div className="flex gap-2">
              {workflowShowcase.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? "w-8 bg-slate-900"
                      : "w-2 bg-slate-400/30 hover:bg-slate-400/50"
                  }`}
                  aria-label={`Show ${routeVisualMeta[item.id].panelTitle}`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={prevSlide}
                className="rounded-lg border border-slate-200 p-2 transition-colors hover:bg-slate-100"
                aria-label="Previous page"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M12.5 15L7.5 10L12.5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="rounded-lg border border-slate-200 p-2 transition-colors hover:bg-slate-100"
                aria-label="Next page"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M7.5 15L12.5 10L7.5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
