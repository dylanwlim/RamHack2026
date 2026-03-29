"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { sourceRail } from "@/lib/content";
import { motionEase, motionTiming } from "@/lib/motion";

const railItems = [...sourceRail, ...sourceRail];

export function DataRail() {
  const topRowRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let topAnimationId = 0;
    let bottomAnimationId = 0;
    let topPosition = 0;
    let bottomPosition = 0;

    const animateTopRow = () => {
      if (topRowRef.current) {
        topPosition -= 0.5;
        if (Math.abs(topPosition) >= topRowRef.current.scrollWidth / 2) {
          topPosition = 0;
        }
        topRowRef.current.style.transform = `translateX(${topPosition}px)`;
      }
      topAnimationId = window.requestAnimationFrame(animateTopRow);
    };

    const animateBottomRow = () => {
      if (bottomRowRef.current) {
        bottomPosition -= 0.65;
        if (Math.abs(bottomPosition) >= bottomRowRef.current.scrollWidth / 2) {
          bottomPosition = 0;
        }
        bottomRowRef.current.style.transform = `translateX(${bottomPosition}px)`;
      }
      bottomAnimationId = window.requestAnimationFrame(animateBottomRow);
    };

    topAnimationId = window.requestAnimationFrame(animateTopRow);
    bottomAnimationId = window.requestAnimationFrame(animateBottomRow);

    return () => {
      window.cancelAnimationFrame(topAnimationId);
      window.cancelAnimationFrame(bottomAnimationId);
    };
  }, []);

  return (
    <section id="sources" className="section-space bg-white">
      <div className="site-shell">
        <div className="mx-auto max-w-[42.5rem]">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: motionTiming.reveal, ease: motionEase.standard }}
            className="flex flex-col items-center mb-20 text-center"
          >
            <span className="eyebrow-label">Inputs and boundaries</span>
            <h2 className="mt-6 text-[40px] font-normal leading-tight tracking-tight text-[#202020]">
              The UI separates live nearby search from medication evidence.
            </h2>
            <p className="mt-4 max-w-[37.5rem] text-lg leading-7 text-[#666666]">
              Google Maps answers where to call. FDA records help explain why a medication may be
              easier or harder to route. Methodology keeps those signals from collapsing into one
              fake claim.
            </p>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2, ease: motionEase.standard }}
              className="mt-6"
            >
              <Link href="/methodology" className="template-button-secondary border-slate-200">
                Review the methodology
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="relative -mt-6 mb-0 h-[268px] overflow-hidden pb-0">
        <div
          ref={topRowRef}
          className="absolute top-6 flex items-start gap-6 whitespace-nowrap"
          style={{ willChange: "transform" }}
        >
          {[...railItems, ...railItems].map((item, index) => (
            <div
              key={`top-${item}-${index}`}
              className="flex h-20 min-w-[14rem] flex-shrink-0 items-center justify-center rounded-[1.4rem]"
              style={{
                backgroundImage: "linear-gradient(rgb(255, 255, 255), rgb(252, 252, 252))",
                boxShadow:
                  "rgba(0, 0, 0, 0.04) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 1px 0px, rgba(0, 0, 0, 0.04) 0px 3px 3px -1.4px, rgba(0, 0, 0, 0.04) 0px 6px 6px -3px, rgba(0, 0, 0, 0.04) 0px 12px 12px -6px, rgba(0, 0, 0, 0.04) 0px 12px 12px -12px",
              }}
            >
              <span className="text-sm font-medium text-slate-700">{item}</span>
            </div>
          ))}
        </div>

        <div
          className="absolute bottom-0 left-0 top-0 z-10 h-[268px] w-60 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(90deg, rgb(255, 255, 255), rgba(0, 0, 0, 0))",
          }}
        />

        <div
          className="absolute bottom-0 right-0 top-0 z-10 h-[268px] w-60 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(90deg, rgba(0, 0, 0, 0), rgb(255, 255, 255))",
          }}
        />

        <div
          ref={bottomRowRef}
          className="absolute top-[148px] flex items-start gap-6 whitespace-nowrap"
          style={{ willChange: "transform" }}
        >
          {[...railItems, ...railItems].map((item, index) => (
            <div
              key={`bottom-${item}-${index}`}
              className="flex h-20 min-w-[14rem] flex-shrink-0 items-center justify-center rounded-[1.4rem] bg-slate-950"
              style={{
                boxShadow:
                  "rgba(0, 0, 0, 0.04) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 1px 0px, rgba(0, 0, 0, 0.04) 0px 3px 3px -1.4px, rgba(0, 0, 0, 0.04) 0px 6px 6px -3px, rgba(0, 0, 0, 0.04) 0px 12px 12px -6px, rgba(0, 0, 0, 0.04) 0px 12px 12px -12px",
              }}
            >
              <span className="text-sm font-medium text-white">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
