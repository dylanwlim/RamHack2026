import Link from "next/link";
import { featuredSearches } from "@/lib/content";
import { cn } from "@/lib/utils";

type ExampleScenarioGridProps = {
  mode: "patient" | "prescriber";
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
};

function buildScenarioHref(
  mode: "patient" | "prescriber",
  search: (typeof featuredSearches)[number],
) {
  if (mode === "prescriber") {
    return `/prescriber?query=${encodeURIComponent(search.medication)}`;
  }

  return `/patient/results?query=${encodeURIComponent(search.medication)}&location=${encodeURIComponent(search.location)}&radiusMiles=5&sortBy=best_match&onlyOpenNow=false`;
}

export function ExampleScenarioGrid({
  mode,
  eyebrow,
  title,
  description,
  className,
}: ExampleScenarioGridProps) {
  return (
    <section className={cn("space-y-5", className)}>
      <div className="max-w-3xl">
        <span className="eyebrow-label">{eyebrow}</span>
        <h2 className="mt-5 text-[2.2rem] leading-tight tracking-tight text-slate-950">{title}</h2>
        <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {featuredSearches.map((search) => (
          <Link
            key={search.id}
            href={buildScenarioHref(mode, search)}
            className="surface-panel flex h-full flex-col gap-4 rounded-[1.9rem] p-5 transition-colors duration-150 hover:border-[#156d95]/20 hover:bg-white"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {search.label}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {mode === "prescriber" ? "Medication Lookup" : "Pharmacy Finder"}
              </span>
            </div>

            <div>
              <h3 className="text-xl tracking-tight text-slate-950">{search.medication}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === "prescriber" ? `Often paired with ${search.location}` : search.location}
              </p>
            </div>

            <p className="text-sm leading-6 text-slate-600">{search.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
