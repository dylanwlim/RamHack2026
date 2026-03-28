"use client";

import { motion } from "framer-motion";
import { homeStats } from "@/lib/content";

const bars = Array.from({ length: 32 }, (_, index) => ({
  id: index,
  left: index * 22,
  height: 80 + ((index * 37) % 170),
  direction: index % 3 === 0 ? "down" : "up",
  delay: index * 0.04,
}));

export function AccessScaleSection() {
  return (
    <section id="story" className="section-space">
      <div className="site-shell">
        <div className="grid grid-cols-12 gap-5 gap-y-16">
          <div className="col-span-12 md:col-span-6">
            <span className="eyebrow-label">Signal model</span>
            <h2 className="mt-8 text-[2.7rem] leading-tight tracking-tight text-slate-950 sm:text-[3rem]">
              Nearby discovery stays live while the medication story stays honest.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              PharmaPath treats Google Places and openFDA as two different layers. One finds real
              nearby pharmacies. The other explains why filling a medication may be easier or harder
              than average. They should be shown together, but never confused.
            </p>
          </div>

          <div className="col-span-12 md:col-span-6">
            <div className="relative h-[24rem] overflow-hidden rounded-[2rem] border border-white/80 bg-white/80">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(41,120,192,0.14),_transparent_38%)]" />
              <div className="absolute inset-x-10 inset-y-10">
                {bars.map((bar) => (
                  <motion.div
                    key={bar.id}
                    initial={{ opacity: 0, height: 0 }}
                    whileInView={{ opacity: 1, height: bar.height }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 1.4, delay: bar.delay, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute w-2 rounded-full"
                    style={{
                      left: `${bar.left}px`,
                      top: bar.direction === "down" ? "4rem" : `${18.8 - bar.height / 28}rem`,
                      background:
                        bar.direction === "down"
                          ? "linear-gradient(180deg, rgba(20,110,150,0.6), rgba(114,190,219,0.08))"
                          : "linear-gradient(180deg, rgba(138,211,192,0.12), rgba(18,99,127,0.62))",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-12">
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {homeStats.map((stat, index) => (
                <motion.div
                  key={stat.value + stat.description}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="flex flex-col gap-3"
                >
                  <span className="text-3xl font-medium tracking-tight text-[#156d95]">{stat.value}</span>
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
                    {stat.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
