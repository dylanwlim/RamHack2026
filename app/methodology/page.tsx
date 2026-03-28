import { HealthStatusCard } from "@/components/search/health-status-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";

export default function MethodologyPage() {
  return (
    <>
      <SiteNavbar />
      <main>
        <section className="px-4 pb-16 pt-28 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <span className="eyebrow-label">Methodology</span>
              <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.5rem]">
                Be explicit about what the data can support.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                PharmaPath reads openFDA records for medication context and Google Places results for
                nearby pharmacy discovery. Those layers are useful together, but they are not the
                same thing and the UI should never pretend they are.
              </p>
            </div>

            <HealthStatusCard />
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-5 lg:grid-cols-3">
            <div className="surface-panel rounded-[2rem] p-6">
              <span className="eyebrow-label">Known</span>
              <ul className="mt-5 space-y-3 text-base leading-7 text-slate-700">
                <li>Live nearby pharmacy discovery from Google Places</li>
                <li>FDA listing, shortage, approval, and recall records</li>
                <li>Store addresses, ratings, open-now status, and map links</li>
              </ul>
            </div>

            <div className="surface-panel rounded-[2rem] p-6">
              <span className="eyebrow-label">Inferred carefully</span>
              <ul className="mt-5 space-y-3 text-base leading-7 text-slate-700">
                <li>Medication-wide access friction labels such as steadier, mixed, or higher friction</li>
                <li>Whether broader planning or alternative consideration may help</li>
                <li>Which nearby pharmacy is the best first call based on the workflow heuristic</li>
              </ul>
            </div>

            <div className="surface-panel rounded-[2rem] p-6">
              <span className="eyebrow-label">Unavailable</span>
              <ul className="mt-5 space-y-3 text-base leading-7 text-slate-700">
                <li>Real-time shelf inventory at a specific store</li>
                <li>Guaranteed same-day pickup</li>
                <li>Insurance approval, copay, or patient-specific fulfillment outcome</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="surface-panel rounded-[2rem] p-6">
              <span className="eyebrow-label">Why the patient page is separate</span>
              <p className="mt-5 text-base leading-7 text-slate-700">
                Patients need the nearby list, the signal label, and the next questions to ask. They
                do not need the full approval or recall evidence first.
              </p>
            </div>
            <div className="surface-panel rounded-[2rem] p-6">
              <span className="eyebrow-label">Why the prescriber page is separate</span>
              <p className="mt-5 text-base leading-7 text-slate-700">
                Prescribers need the evidence trail. That includes shortage status, manufacturer
                breadth, formulation spread, and whether an alternative plan may deserve attention.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
