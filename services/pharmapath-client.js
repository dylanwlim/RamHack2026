const sampleSearches = [
  {
    id: "brooklyn-adderall",
    label: "Brooklyn search",
    title: "Controlled-medication handoff in Brooklyn",
    description:
      "Shows a higher-friction medication search where the first outreach favors trusted nearby pharmacies and an honest stock disclaimer.",
    filters: {
      medication: "Adderall XR",
      location: "Brooklyn, NY",
      radiusMiles: 5,
      sortBy: "best_match",
      onlyOpenNow: false,
    },
  },
  {
    id: "queens-adderall",
    label: "Queens search",
    title: "Same medication, different borough",
    description:
      "Use the same medication as Brooklyn to prove the real Google pharmacy set changes materially with the location input.",
    filters: {
      medication: "Adderall XR",
      location: "Queens, NY",
      radiusMiles: 5,
      sortBy: "best_match",
      onlyOpenNow: false,
    },
  },
  {
    id: "brooklyn-amoxicillin",
    label: "Medication swap",
    title: "Different medication, same borough",
    description:
      "Keeps Brooklyn fixed while changing the medication so the ranking emphasis and pharmacy call guidance both shift.",
    filters: {
      medication: "Amoxicillin 500mg",
      location: "Brooklyn, NY",
      radiusMiles: 5,
      sortBy: "best_match",
      onlyOpenNow: false,
    },
  },
];

const medicationSuggestions = [
  "Adderall XR",
  "Amoxicillin 500mg",
  "Ozempic",
  "Sertraline",
  "Vyvanse",
  "Metformin",
  "Wegovy",
  "Albuterol",
];

function buildRequestPayload(filters) {
  return {
    medication: filters.medication.trim(),
    location: filters.location.trim(),
    radiusMiles: Number(filters.radiusMiles || 5),
    sortBy: filters.sortBy || "best_match",
    onlyOpenNow: Boolean(filters.onlyOpenNow),
  };
}

function getErrorMessage(payload, fallback) {
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  return fallback;
}

export function createPharmaPathClient({ fetchImpl = window.fetch.bind(window) } = {}) {
  return {
    listSampleSearches() {
      return sampleSearches;
    },

    listMedicationSuggestions() {
      return medicationSuggestions;
    },

    getInitialFilters() {
      return { ...sampleSearches[0].filters };
    },

    async searchPharmacies(filters) {
      const response = await fetchImpl("/api/pharmacies/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(buildRequestPayload(filters)),
      });

      let payload = null;

      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Unable to search nearby pharmacies right now."),
        );
      }

      return payload;
    },
  };
}
