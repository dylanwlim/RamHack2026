import { PageTransitionShell } from "@/components/page-transition-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";

const signalLayers = [
  {
    label: "Nearby search",
    description:
      "Shows nearby pharmacies, hours, ratings, distance, and map links for the area you searched.",
    accent: "bg-sky-50 border-sky-200",
    dot: "bg-sky-500",
    eyebrow: "text-sky-600",
  },
  {
    label: "Medication reference",
    description:
      "Helps match names, strengths, dosage forms, and medication families so the lookup stays specific.",
    accent: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
    eyebrow: "text-emerald-600",
  },
  {
    label: "Supply context",
    description:
      "Adds shortage and recall context that may affect how hard a medication is to fill.",
    accent: "bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
    eyebrow: "text-amber-600",
  },
  {
    label: "Community reports",
    description:
      "Signed-in contributors can add reports. Those reports remain separate from the nearby search and are never shown as guaranteed inventory.",
    accent: "bg-teal-50 border-teal-200",
    dot: "bg-teal-500",
    eyebrow: "text-teal-600",
  },
];

const boundaries = [
  { label: "Nearby pharmacies and call-ready sorting", available: true },
  { label: "Medication-wide supply and safety context", available: true },
  { label: "Community reports with clear caveats", available: true },
  { label: "Real-time shelf inventory at a specific store", available: false },
  { label: "Guaranteed same-day pickup", available: false },
  { label: "Insurance approval or copay outcome", available: false },
];

const readingGuide = [
  {
    title: "Search inputs",
    value: "Plain-language search",
    detail:
      "Medication and location inputs are normalized into a cleaner shortlist and a clearer next question.",
  },
  {
    title: "Access summary",
    value: "Context, not certainty",
    detail:
      "PharmaPath describes likely fill difficulty and relevant follow-up questions, not confirmed inventory.",
  },
  {
    title: "Community layer",
    value: "Separate by design",
    detail:
      "Recent reports add context where available, but they never replace direct confirmation from the pharmacy.",
  },
];

const responsibleUse = [
  "Call the pharmacy directly before assuming availability.",
  "Confirm the exact strength and formulation that matters for the prescription.",
  "Use clinician judgment for treatment changes, substitutions, and urgency.",
  "Do not rely on PharmaPath for emergency care decisions.",
];

export default function MethodologyPage() {
  return (
    <>
      <SiteNavbar />
      <PageTransitionShell>
        <section className="px-4 pb-16 pt-28 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <span className="eyebrow-label">Methodology</span>
              <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.5rem]">
                What PharmaPath can support directly, and what still needs a call.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                PharmaPath is built to be useful without overselling certainty. This page explains
                how the product separates direct information, inferred context, and still-manual
                steps.
              </p>
            </div>
            <div className="surface-panel rounded-[2.25rem] bg-white/94 p-6 shadow-none backdrop-blur-none sm:p-8">
              <span className="eyebrow-label">Reading guide</span>
              <div className="mt-6 space-y-3">
                {readingGuide.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
                      <span className="text-sm font-medium text-slate-500">{item.value}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div className="site-shell">
            <span className="eyebrow-label">Signal layers</span>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {signalLayers.map((layer) => (
                <div key={layer.label} className={`rounded-[2rem] border p-6 ${layer.accent}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${layer.dot}`} />
                    <span
                      className={`text-xs font-semibold uppercase tracking-[0.18em] ${layer.eyebrow}`}
                    >
                      {layer.label}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-700">{layer.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="surface-panel rounded-[2rem] p-6 sm:p-7">
              <span className="eyebrow-label">Claim boundary</span>
              <h2 className="mt-4 text-2xl tracking-tight text-slate-950">
                Useful guidance stays visible. Guarantees stay out.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                PharmaPath keeps live nearby discovery, medication context, contributor reports, and
                still-manual steps separate so the product never reads like a stock feed.
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-5">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Shown directly
                  </span>
                  <ul className="mt-4 space-y-3">
                    {boundaries
                      .filter((item) => item.available)
                      .map((item) => (
                        <li
                          key={item.label}
                          className="flex items-start gap-3 text-sm leading-6 text-slate-700"
                        >
                          <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                          {item.label}
                        </li>
                      ))}
                  </ul>
                </div>
                <div className="rounded-[1.5rem] border border-rose-100 bg-rose-50/70 p-5">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                    Still manual
                  </span>
                  <ul className="mt-4 space-y-3">
                    {boundaries
                      .filter((item) => !item.available)
                      .map((item) => (
                        <li
                          key={item.label}
                          className="flex items-start gap-3 text-sm leading-6 text-slate-700"
                        >
                          <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-rose-400" />
                          {item.label}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="surface-panel rounded-[2rem] p-6 sm:p-7">
              <span className="eyebrow-label">Responsible use</span>
              <h2 className="mt-4 text-2xl tracking-tight text-slate-950">
                Use the shortlist, then verify the answer.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                PharmaPath is designed to help people ask better questions faster. It does not
                replace direct confirmation, clinical judgment, or urgent care.
              </p>
              <ul className="mt-6 space-y-3">
                {responsibleUse.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-slate-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </PageTransitionShell>
      <SiteFooter />
    </>
  );
}
