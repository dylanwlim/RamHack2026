import type { Metadata } from "next";
import Link from "next/link";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { ExampleScenarioGrid } from "@/components/search/example-scenario-grid";
import { PharmacySearchForm } from "@/components/search/pharmacy-search-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";
import { openSurfaceLabels, surfaceNames } from "@/lib/surface-labels";

export const metadata: Metadata = {
  title: "Pharmacy Finder | PharmaPath",
  description:
    "Search a medication and location to find nearby pharmacies with medication access context, without overstating stock certainty.",
  alternates: {
    canonical: "https://pharmapath.org/pharmacy-finder",
  },
};

export default function PharmacyFinderPage() {
  return (
    <>
      <SiteNavbar />
      <PageTransitionShell>
        <section className="px-4 pb-4 pt-20 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-7 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start lg:gap-7 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:gap-9">
            <div className="max-w-[30rem] pt-1 sm:max-w-[32rem]">
              <span className="eyebrow-label">{surfaceNames.patient}</span>
              <h1 className="mt-[1.125rem] max-w-[26rem] text-[2.35rem] leading-[0.97] tracking-tight text-balance text-slate-950 sm:text-[2.72rem] lg:max-w-[27rem] xl:text-[2.95rem]">
                Search a medication and location without pretending the stock is
                guaranteed.
              </h1>
              <p className="mt-3.5 max-w-[27rem] text-[1rem] leading-7 text-slate-600 sm:text-[1.05rem]">
                Pharmacy Finder keeps the live nearby list and medication
                context separate so the first call stays clear.
              </p>
            </div>

            <PharmacySearchForm
              className="justify-self-stretch"
              showSamples
              submitLabel="Find nearby pharmacies"
            />
          </div>
        </section>

        <section className="px-4 pb-14 sm:px-6 lg:px-8">
          <div className="site-shell">
            <ExampleScenarioGrid
              mode="patient"
              eyebrow="Quick starts"
              title="Four quick-start searches, each tuned to a real workflow."
              description="Use these to move through realistic medication and location combinations without implying store-level inventory."
            />

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/prescriber"
                className="action-button-secondary text-sm"
              >
                {openSurfaceLabels.prescriber}
              </Link>
            </div>
          </div>
        </section>
      </PageTransitionShell>
      <SiteFooter />
    </>
  );
}
