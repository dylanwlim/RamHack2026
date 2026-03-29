export type SearchScenario = {
  id: string;
  label: string;
  medication: string;
  location: string;
  description: string;
};

export const searchScenarios: SearchScenario[] = [
  {
    id: "controlled-stimulant",
    label: "Controlled stimulant",
    medication: "Adderall XR 20 mg",
    location: "Brooklyn, NY",
    description:
      "A higher-friction handoff where the nearby list stays live and the medication context stays explicit.",
  },
  {
    id: "glp-1-refill",
    label: "GLP-1 refill",
    medication: "Wegovy 0.25 mg/0.5 ml",
    location: "Queens, NY",
    description:
      "Useful for shipment-sensitive questions without implying a specific dose is on the shelf.",
  },
  {
    id: "same-day-antibiotic",
    label: "Same-day antibiotic",
    medication: "Amoxicillin 500 mg capsule",
    location: "Hoboken, NJ",
    description:
      "A speed-sensitive path where open status and short travel time matter more than a perfect score.",
  },
  {
    id: "routine-refill",
    label: "Routine refill",
    medication: "Sertraline 50 mg tablet",
    location: "Lower Manhattan, NY",
    description:
      "A steadier refill flow that still keeps transfer timing and confirmation separate from inventory claims.",
  },
];
