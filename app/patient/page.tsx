import Link from "next/link";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { ExampleScenarioGrid } from "@/components/search/example-scenario-grid";
import { PharmacySearchForm } from "@/components/search/pharmacy-search-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";

export default function PatientPage() {
  return (
    <>
      <SiteNavbar />
      <PageTransitionShell>
        <section className="px-4 pb-16 pt-28 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <span className="eyebrow-label">Pharmacy Finder</span>
              <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.5rem]">
                Search a medication and location without pretending the stock is guaranteed.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Pharmacy Finder keeps one live nearby list, one clearly sourced medication signal,
                and the next question to ask. It stays useful by keeping those jobs separate.
              </p>
            </div>

            <PharmacySearchForm showSamples submitLabel="Search live nearby pharmacies" />
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div className="site-shell">
            <ExampleScenarioGrid
              mode="patient"
              eyebrow="Example searches"
              title="Four demo-ready searches, each tuned to a real workflow."
              description="Use these to move quickly through realistic medication and location combinations without implying store-level inventory certainty."
            />

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/prescriber" className="template-button-secondary text-sm">
                Open Medication Lookup
              </Link>
            </div>
          </div>
        </section>
      </PageTransitionShell>
      <SiteFooter />
    </>
  );
}
