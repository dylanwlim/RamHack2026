import { searchScenarios } from "./search-options";

export type FeaturedSearch = {
  id: string;
  label: string;
  medication: string;
  location: string;
  description: string;
};

export const featuredSearches: FeaturedSearch[] = searchScenarios.map((scenario) => ({
  id: scenario.id,
  label: scenario.label,
  medication: scenario.medication,
  location: scenario.location,
  description: scenario.description,
}));

export const workflowShowcase = [
  {
    id: "patient",
    title: "Pharmacy Finder keeps the first call path tight.",
    summary:
      "Search the FDA-backed medication catalog plus any Google-resolved location to load the nearby list, one access read, and the next question to ask.",
    bullets: [
      "Nearby list from Google Places",
      "Medication-wide FDA context, not store inventory",
      "Call-ready questions without fake certainty",
    ],
    href: "/patient",
    accent: "from-sky-100 via-white to-cyan-50",
  },
  {
    id: "prescriber",
    title: "Medication Lookup keeps the evidence trail intact.",
    summary:
      "Start with the medication itself when the question is shortage context, manufacturer breadth, recall activity, or earlier alternative planning.",
    bullets: [
      "Shortage and recall evidence",
      "Formulation, route, and manufacturer context",
      "No claim that any pharmacy can fill it right now",
    ],
    href: "/prescriber",
    accent: "from-emerald-100 via-white to-teal-50",
  },
  {
    id: "methodology",
    title: "Methodology keeps the boundary explicit.",
    summary:
      "See which parts come directly from Google Maps and FDA records, which parts are inferred, and which questions still require a pharmacy call.",
    bullets: [
      "Live config status from /api/health",
      "Known vs inferred vs unavailable",
      "Truthful copy without overclaiming",
    ],
    href: "/methodology",
    accent: "from-amber-100 via-white to-orange-50",
  },
];

export const homeFaqs = [
  {
    question: "Does PharmaPath know whether a pharmacy has the medication in stock right now?",
    answer:
      "No. PharmaPath can show live nearby pharmacy results from Google Places, but stock still has to be confirmed directly with the pharmacy. The medication info is derived from FDA listing, shortage, approval, and recall data, not from shelf-level inventory feeds.",
  },
  {
    question: "Why separate the pharmacy and medication pages?",
    answer:
      "Pharmacy Finder is built for the nearby call list and next outreach step. Medication Lookup keeps the evidence trail together: shortage status, manufacturer breadth, formulation spread, and recall context.",
  },
  {
    question: "Where does PharmaPath get its data?",
    answer:
      "Nearby pharmacy search uses Google Maps Platform for freeform location autocomplete, resolution, and live nearby pharmacy results. Medication evidence comes from FDA records, including listings, shortage files, recall notices, and approval history. Any clearly labeled fictional medication entries stay isolated from that FDA-backed catalog. When signed-in users submit reports, those appear as a separate crowd layer rather than as public-source inventory proof.",
  },
];
