import Link from "next/link";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { ExampleScenarioGrid } from "@/components/search/example-scenario-grid";
import { PharmacySearchForm } from "@/components/search/pharmacy-search-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";
import { openSurfaceLabels, surfaceNames } from "@/lib/surface-labels";

export default function PatientPage() {
  return (
    <>
      <SiteNavbar />
      <PageTransitionShell>
        <section className="px-4 pb-14 pt-24 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:gap-10">
            <div className="max-w-[29rem] pt-1 sm:max-w-[31rem]">
              <span className="eyebrow-label">{surfaceNames.patient}</span>
              <h1 className="mt-5 max-w-[26rem] text-[2.55rem] leading-[0.97] tracking-tight text-balance text-slate-950 sm:text-[2.95rem] lg:max-w-[27rem] xl:text-[3.25rem]">
                Search a medication and location without pretending the stock is
                guaranteed.
              </h1>
              <p className="mt-4 max-w-[28rem] text-[1.02rem] leading-7 text-slate-600 sm:text-[1.08rem]">
                Pharmacy Finder keeps the live nearby list, medication context,
                and next question separate so the first call stays clear.
              </p>
            </div>

            <PharmacySearchForm
              className="justify-self-stretch"
              showSamples
              submitLabel="Find nearby pharmacies"
            />
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
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
