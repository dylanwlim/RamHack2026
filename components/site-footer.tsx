"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { motionEase, motionTiming } from "@/lib/motion";
import { SiteBrand } from "@/components/site-brand";

const footerSections = [
  {
    title: "Product",
    links: [
      { label: "Pharmacy Finder", href: "/patient" },
      { label: "Pharmacy Results", href: "/patient/results" },
      { label: "Medication Lookup", href: "/prescriber" },
    ],
  },
  {
    title: "Evidence",
    links: [
      { label: "Methodology", href: "/methodology" },
      { label: "Health status", href: "/methodology#health" },
    ],
  },
  {
    title: "Repo",
    links: [
      { label: "GitHub", href: "https://github.com/dylanwlim/PharmaPath" },
      { label: "Live app", href: "https://pharmapath.org/" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact Us", href: "/contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-[#e5e5e5] bg-[#fafafa]">
      <div className="site-shell py-16">
        <div className="grid grid-cols-2 gap-8 mb-12 md:grid-cols-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, ease: motionEase.standard }}
            className="col-span-2"
          >
            <div className="mb-4">
              <SiteBrand className="mb-2" wordmarkClassName="text-2xl font-medium" />
              <p className="max-w-xs text-sm leading-5 text-[#666666]">
                Live nearby pharmacy search with medication access context. Guidance is meant to support better calls, not guarantee stock.
              </p>
            </div>
          </motion.div>

          {footerSections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: motionEase.standard,
              }}
              className="col-span-1"
            >
              <h3 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-[#202020]">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#666666] transition-colors duration-150 hover:text-[#202020]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: motionTiming.reveal, ease: motionEase.standard }}
          className="border-t border-[#e5e5e5] pt-8"
        >
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <p className="text-sm text-[#666666]">© PharmaPath 2026.</p>
            <div className="flex items-center gap-6">
              <Link
                href="/patient"
                className="text-sm text-[#666666] transition-colors duration-150 hover:text-[#202020]"
              >
                Start Search
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
