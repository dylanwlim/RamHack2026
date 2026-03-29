export type FeaturedSearch = {
  id: string;
  label: string;
  medication: string;
  location: string;
  description: string;
};

export const featuredSearches: FeaturedSearch[] = [
  {
    id: "brooklyn-adderall",
    label: "Controlled stimulant",
    medication: "Adderall XR 20 mg",
    location: "Brooklyn, NY",
    description:
      "A higher-friction handoff where the nearby list stays live and the medication info stays careful.",
  },
  {
    id: "queens-wegovy",
    label: "GLP-1 refill",
    medication: "Wegovy",
    location: "Queens, NY",
    description:
      "See shipment-sensitive guidance without claiming any store has dose-level stock confirmed.",
  },
  {
    id: "hoboken-amoxicillin",
    label: "Same-day antibiotic",
    medication: "Amoxicillin 500 mg",
    location: "Hoboken, NJ",
    description:
      "A speed-sensitive search where the nearby ordering should lean hard toward open and close-by options.",
  },
  {
    id: "downtown-sertraline",
    label: "Routine refill",
    medication: "Sertraline 50 mg",
    location: "Lower Manhattan, NY",
    description:
      "A steadier refill flow that should still surface clear next questions instead of pretending the refill is guaranteed.",
  },
];

export const homeStats = [
  {
    value: "4",
    description: "FDA datasets\ntranslated into one signal",
  },
  {
    value: "2",
    description: "Patient and prescriber\nviews kept separate",
  },
  {
    value: "1",
    description: "Live nearby pharmacy\nlookup route",
  },
  {
    value: "0",
    description: "Fake claims about\nverified inventory",
  },
];

export const workflowShowcase = [
  {
    id: "patient",
    title: "Patient search keeps the first answer short.",
    summary:
      "Medication plus location produces a live nearby list, FDA access info, and a call-ready set of questions.",
    bullets: [
      "Nearby list from Google Places",
      "Medication-wide FDA data, not store inventory",
      "Plain-language questions for the next call",
    ],
    href: "/patient",
    accent: "from-sky-100 via-white to-cyan-50",
  },
  {
    id: "prescriber",
    title: "Prescriber view keeps the evidence trail intact.",
    summary:
      "Same medication search, but with shortage records, manufacturer spread, recall context, and alternative-planning cues surfaced first.",
    bullets: [
      "Shortage and recall evidence",
      "Formulation, route, and manufacturer context",
      "No claim that a pharmacy can fill right now",
    ],
    href: "/prescriber",
    accent: "from-emerald-100 via-white to-teal-50",
  },
  {
    id: "methodology",
    title: "Methodology shows the boundary before trust breaks.",
    summary:
      "The app distinguishes what is known from Google Places and openFDA, what is inferred, and what still needs a direct phone call.",
    bullets: [
      "Live config status from /api/health",
      "Known vs inferred vs unavailable",
      "Truthful positioning for demo and deployment",
    ],
    href: "/methodology",
    accent: "from-amber-100 via-white to-orange-50",
  },
];

export const sourceRail = [
  "Google Places",
  "NDC Listings",
  "Drug Shortages",
  "Drugs@FDA",
  "Recall Enforcement",
  "Methodology Guardrails",
  "Nearby Ranking",
  "Access Routing",
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
      "Pharmacy lookup helps those who need a fast list and a pointer of where to call. Medication lookup gives the evidence trail: shortage status, manufacturer breadth, formulation spread, and recall context.",
  },
  {
    question: "Where does PharmaPath get its data?",
    answer:
      "Nearby pharmacy results come from the Google Places API, which provides live names, addresses, ratings, hours, and location data. Medication information like shortages, recalls, approvals, and manufacturer details comes from openFDA, the public API maintained by the U.S. Food and Drug Administration. Over time, PharmaPath also incorporates crowdsourced input from users to help improve accuracy and fill in gaps that official sources don't cover.",
  },
];
