"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { homeStats } from "@/lib/content";
import { motionEase, motionTiming } from "@/lib/motion";

type DataPoint = {
  id: number;
  left: number;
  top: number;
  height: number;
  direction: "up" | "down";
  delay: number;
};

const generateDataPoints = (): DataPoint[] => {
  const points: DataPoint[] = [];
  const baseLeft = 1;
  const spacing = 32;

  for (let index = 0; index < 50; index += 1) {
    const direction = index % 2 === 0 ? "down" : "up";
    const height = ((index * 53) % 120) + 88;
    const top =
      direction === "down" ? ((index * 29) % 150) + 250 : ((index * 23) % 100) - 80;

    points.push({
      id: index,
      left: baseLeft + index * spacing,
      top,
      height,
      direction,
      delay: index * 0.035,
    });
  }

  return points;
};

export function AccessScaleSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [typingComplete, setTypingComplete] = useState(false);
  const [dataPoints] = useState<DataPoint[]>(generateDataPoints);

  useEffect(() => {
    setIsVisible(true);
    const timer = window.setTimeout(() => setTypingComplete(true), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section id="story" className="section-space overflow-hidden bg-white">
      <div className="site-shell">
        <div className="grid grid-cols-12 gap-5 gap-y-16">
          <div className="col-span-12 relative z-10 md:col-span-6">
            <div className="relative mb-12 inline-flex h-6 items-center px-2 font-mono uppercase text-xs text-[#146e96]">
              <div className="flex items-center gap-1 overflow-hidden">
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: "auto" }}
                  transition={{ duration: motionTiming.hero, ease: motionEase.emphasis }}
                  className="block whitespace-nowrap"
                >
                  Signal model
                </motion.span>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: typingComplete ? [1, 0.35, 1, 0.35] : 0 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  className="block h-2 w-2 rounded-full bg-[#167E6C]"
                  style={{ boxShadow: "0 0 18px rgba(22, 126, 108, 0.48)" }}
                />
              </div>
            </div>

            <h2 className="mb-6 text-[40px] font-normal leading-tight tracking-tight text-[#111A4A]">
              Nearby discovery stays live{" "}
              <span className="opacity-40">
                while the medication story stays honest.
              </span>
            </h2>

            <p className="mb-6 mt-0 max-w-[36rem] text-lg leading-6 text-[#111A4A] opacity-60">
              PharmaPath treats Google Places and openFDA as two different layers. One finds real
              nearby pharmacies. The other explains why filling a medication may be easier or harder
              than average. They should be shown together, but never confused.
            </p>

            <Link
              href="/methodology"
              className="group relative mt-5 inline-flex h-9 items-center justify-center rounded-lg bg-white/50 px-4 text-sm font-medium leading-4 text-[#232730] shadow-[0_1px_1px_0_rgba(255,255,255,0),0_0_0_1px_rgba(87,90,100,0.12)] backdrop-blur-sm transition-all duration-200 ease-in-out hover:shadow-[0_1px_2px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(87,90,100,0.18)]"
            >
              <span className="relative z-10 flex items-center gap-1">
                Review the methodology
                <ArrowRight className="h-4 w-4 -mr-1 transition-transform duration-150 group-hover:translate-x-1" />
              </span>
            </Link>
          </div>

          <div className="col-span-12 md:col-span-6">
            <div className="relative h-[416px] w-full overflow-hidden -ml-[200px]">
              <div className="absolute left-[302px] top-0 h-[392px] w-[680px] pointer-events-none overflow-hidden">
                <div className="relative h-full w-full">
                  {dataPoints.map((point) => (
                    <motion.div
                      key={point.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={
                        isVisible
                          ? {
                              opacity: [0, 1, 1],
                              height: [0, point.height, point.height],
                            }
                          : undefined
                      }
                      transition={{
                        duration: 2,
                        delay: point.delay,
                        ease: motionEase.bar,
                      }}
                      className="absolute w-1.5 rounded-[3px]"
                      style={{
                        left: `${point.left}px`,
                        top: `${point.top}px`,
                        background:
                          point.direction === "down"
                            ? "linear-gradient(rgb(176, 200, 196) 0%, rgb(176, 200, 196) 10%, rgba(156, 217, 93, 0.1) 40%, rgba(113, 210, 240, 0) 75%)"
                            : "linear-gradient(to top, rgb(176, 200, 196) 0%, rgb(176, 200, 196) 10%, rgba(156, 217, 93, 0.1) 40%, rgba(113, 210, 240, 0) 75%)",
                        backgroundColor: "rgba(22, 126, 108, 0.01)",
                      }}
                    >
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={isVisible ? { opacity: [0, 1] } : undefined}
                        transition={{ duration: 0.3, delay: point.delay + 1.7 }}
                        className="absolute -left-[1px] h-2 w-2 rounded-full bg-[#167E6C]"
                        style={{
                          top: point.direction === "down" ? "0px" : `${point.height - 8}px`,
                        }}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 pt-14 md:pt-20">
            <div className="overflow-visible pb-5">
              <div className="grid grid-cols-12 gap-5 relative z-10">
                {homeStats.map((stat, index) => (
                  <div key={`${stat.value}-${stat.description}`} className="col-span-6 md:col-span-3">
                    <motion.div
                      initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                      animate={
                        isVisible
                          ? {
                              opacity: [0, 1, 1],
                              y: [20, 0, 0],
                              filter: ["blur(4px)", "blur(0px)", "blur(0px)"],
                            }
                          : undefined
                      }
                      transition={{
                        duration: 1.5,
                        delay: index * 0.2,
                        ease: motionEase.stat,
                      }}
                      className="flex flex-col gap-2"
                    >
                      <span className="text-2xl font-medium leading-[26.4px] tracking-tight text-[#146e96]">
                        {stat.value}
                      </span>
                      <p className="m-0 whitespace-pre-line text-xs leading-[13.2px] text-[#7C7F88]">
                        {stat.description}
                      </p>
                    </motion.div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
