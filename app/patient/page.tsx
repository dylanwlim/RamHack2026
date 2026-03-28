import Link from "next/link";
import { PharmacySearchForm } from "@/components/search/pharmacy-search-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";
import { featuredSearches } from "@/lib/content";

export default function PatientPage() {
  return (
    <>
      <SiteNavbar />
      <main>
        <section className="px-4 pb-16 pt-28 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <span className="eyebrow-label">Patient search</span>
              <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.5rem]">
                Search a medication and location without pretending the stock is guaranteed.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                The patient route keeps one live nearby list, one FDA-derived signal, and the next
                question the patient should ask. It stays useful by keeping those jobs separate.
              </p>
            </div>

            <PharmacySearchForm showSamples submitLabel="Search live nearby pharmacies" />
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-5 lg:grid-cols-3">
            <div className="surface-panel rounded-[2rem] p-6">
              <span className="eyebrow-label">Nearby list</span>
              <h2 className="mt-5 text-2xl tracking-tight text-slate-950">Real pharmacy options first.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Pharmacy names, addresses, hours, ratings, and map links come from live Google
                Places results.
              </p>
            </div>
            <div className="surface-panel rounded-[2rem] p-6">
              <span className="eyebrow-label">Signal summary</span>
              <h2 className="mt-5 text-2xl tracking-tight text-slate-950">Medication friction second.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                openFDA data adds a careful access summary so the user knows whether the call path
                may be straightforward, mixed, or harder.
              </p>
            </div>
            <div className="surface-panel rounded-[2rem] p-6">
              <span className="eyebrow-label">Boundary</span>
              <h2 className="mt-5 text-2xl tracking-tight text-slate-950">Inventory still needs a call.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                PharmaPath will not claim that a nearby pharmacy has the medication confirmed on the
                shelf right now.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4">
            {featuredSearches.map((search) => (
              <Link
                key={search.id}
                href={`/patient/results?query=${encodeURIComponent(search.medication)}&location=${encodeURIComponent(search.location)}&radiusMiles=5&sortBy=best_match&onlyOpenNow=false`}
                className="surface-panel flex flex-col gap-3 rounded-[1.8rem] p-5 transition hover:-translate-y-0.5"
              >
                <div className="text-sm uppercase tracking-[0.18em] text-slate-500">{search.label}</div>
                <div className="text-xl tracking-tight text-slate-950">
                  {search.medication} in {search.location}
                </div>
                <p className="text-sm leading-6 text-slate-600">{search.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
