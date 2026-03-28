import Link from "next/link";

const footerSections = [
  {
    title: "Product",
    links: [
      { label: "Patient search", href: "/patient" },
      { label: "Patient results", href: "/patient/results" },
      { label: "Prescriber view", href: "/prescriber" },
    ],
  },
  {
    title: "Evidence",
    links: [
      { label: "Drug detail", href: "/drug" },
      { label: "Methodology", href: "/methodology" },
      { label: "Health status", href: "/methodology#health" },
    ],
  },
  {
    title: "Repo",
    links: [
      { label: "GitHub", href: "https://github.com/dylanwlim/RamHack2026" },
      { label: "Live app", href: "https://pharmapath-blue.vercel.app/" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-[#fafaf8]">
      <div className="site-shell py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">PharmaPath</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
              Nearby pharmacy search can be live. Medication stock still needs direct confirmation
              with the pharmacy. FDA signals are shown as guidance, not guarantees.
            </p>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-600 transition-colors hover:text-slate-950"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-slate-200/80 pt-6 text-sm text-slate-500">
          Built for RamHack 2026. Google Places handles nearby discovery. openFDA shapes medication
          access signals.
        </div>
      </div>
    </footer>
  );
}
