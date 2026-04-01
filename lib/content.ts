import { searchScenarios } from "./search-options";
import { surfaceNames } from "./surface-labels";

export type FeaturedSearch = {
  id: string;
  label: string;
  medication: string;
  location: string;
  description: string;
};

export const featuredSearches: FeaturedSearch[] = searchScenarios.map(
  (scenario) => ({
    id: scenario.id,
    label: scenario.label,
    medication: scenario.medication,
    location: scenario.location,
    description: scenario.description,
  }),
);

export const workflowShowcase = [
  {
    id: "patient",
    title: `${surfaceNames.patient} keeps the first call path tight.`,
    summary:
      "Search a medication and location to load the nearby list, one access read, and the next question to ask.",
    bullets: [
      "Live nearby search",
      "Medication-wide access context, not store inventory",
      "Call-ready questions without fake certainty",
    ],
    href: "/patient",
    accent: "from-sky-100 via-white to-cyan-50",
  },
  {
    id: "prescriber",
    title: `${surfaceNames.prescriber} keeps the evidence trail intact.`,
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
      "See which parts come from the live search, which parts come from medication reference records, and which questions still require a pharmacy call.",
    bullets: [
      "Known vs inferred vs unavailable",
      "Call-ready guardrails",
      "Truthful copy without overclaiming",
    ],
    href: "/methodology",
    accent: "from-amber-100 via-white to-orange-50",
  },
];

export const homeFaqs = [
  {
    question:
      "Does PharmaPath know whether a pharmacy has the medication in stock right now?",
    answer:
      "No. PharmaPath can show a live nearby pharmacy list and medication access context, but stock still has to be confirmed directly with the pharmacy.",
  },
  {
    question: "Why separate the pharmacy and medication pages?",
    answer:
      "Pharmacy Finder is built for the nearby call list and next outreach step. Medication Lookup keeps the evidence trail together: shortage status, manufacturer breadth, formulation spread, and recall context.",
  },
  {
    question: "What kind of information does PharmaPath use?",
    answer:
      "PharmaPath combines a live nearby pharmacy search with medication reference and supply context. Clearly labeled fictional entries stay separate from the main catalog, and contributor reports are shown as their own layer rather than as proof of inventory.",
  },
];
