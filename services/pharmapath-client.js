const sampleSearches = [
  {
    id: "brooklyn-adderall",
    label: "Brooklyn search",
    title: "Controlled-medication handoff in Brooklyn",
    description:
      "Use a high-friction medication search to show how PharmaPath surfaces nearby pharmacies and honest next steps fast.",
    filters: {
      medication: "Adderall XR",
      location: "Brooklyn, NY",
      radiusMiles: 5,
      sortBy: "best_match",
      onlyOpenNow: false,
    },
  },
  {
    id: "queens-ozempic",
    label: "Queens search",
    title: "Chronic therapy search around Queens",
    description:
      "Good for showing higher-volume pharmacies, ranking by rating, and the reminder to verify inventory before sending the prescription.",
    filters: {
      medication: "Ozempic",
      location: "Astoria, Queens, NY",
      radiusMiles: 5,
      sortBy: "rating",
      onlyOpenNow: false,
    },
  },
  {
    id: "manhattan-sertraline",
    label: "Manhattan search",
    title: "Maintenance medication near Midtown",
    description:
      "Demonstrates a steadier refill workflow with a tighter radius and closest-first sorting.",
    filters: {
      medication: "Sertraline",
      location: "Midtown Manhattan, NY",
      radiusMiles: 3,
      sortBy: "distance",
      onlyOpenNow: true,
    },
  },
];

const medicationSuggestions = [
  "Adderall XR",
  "Amoxicillin",
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
