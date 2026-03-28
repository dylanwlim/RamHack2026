import Link from "next/link";
import { sourceRail } from "@/lib/content";

const railItems = [...sourceRail, ...sourceRail];

export function DataRail() {
  return (
    <section id="sources" className="section-space bg-white/70">
      <div className="site-shell">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow-label">Inputs and boundaries</span>
          <h2 className="mt-6 section-title">The UI separates live nearby search from medication evidence.</h2>
          <p className="mx-auto mt-4 section-copy">
            Google Places answers where to call. openFDA helps explain whether the medication may be
            harder to source. Methodology keeps those meanings from collapsing into one fake claim.
          </p>
          <Link
            href="/methodology"
            className="mt-6 inline-flex rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-900"
          >
            Review the methodology
          </Link>
        </div>
      </div>

      <div className="mt-16 overflow-hidden">
        <div className="animated-rail px-4">
          {railItems.map((item, index) => (
            <div
              key={`top-${item}-${index}`}
              className="flex h-20 min-w-[14rem] items-center justify-center rounded-[1.7rem] border border-slate-200 bg-white px-5 shadow-[0_10px_32px_rgba(15,23,42,0.05)]"
            >
              <span className="text-sm font-medium text-slate-700">{item}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 animated-rail reverse px-4">
          {railItems.map((item, index) => (
            <div
              key={`bottom-${item}-${index}`}
              className="flex h-20 min-w-[14rem] items-center justify-center rounded-[1.7rem] border border-slate-200 bg-slate-950 px-5 shadow-[0_10px_32px_rgba(15,23,42,0.12)]"
            >
              <span className="text-sm font-medium text-white">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
