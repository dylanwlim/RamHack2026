/**
 * Live API adapter for PharmaPath.
 *
 * Drop-in replacement for the mock client — same interface, but fetches real
 * pharmacy data from the deployed FastAPI backend.
 *
 * Usage in script.js:
 *   import { createLiveAdapter } from "./services/api-adapter.js";
 *   const client = createPharmaPathClient({ adapter: createLiveAdapter("https://your-api.onrender.com") });
 */

import { demoScenarios } from "../data/demo-data.js";
import { createMockPharmaPathClient } from "./pharmapath-client.js";

const STATUS_PRIORITY = {
  "In stock": 0,
  "Limited fill": 1,
  "Low stock": 2,
  "Out of stock": 3,
};

function formatDistance(d) {
  return `${d.toFixed(1)} mi`;
}

function decorateAPIResult(item) {
  const statusClass = `status-${item.status.toLowerCase().replaceAll(" ", "-")}`;
  return {
    ...item,
    id: `${item.pharmacy}-${item.address}`,
    pharmacyType: detectPharmacyType(item.pharmacy),
    distanceMiles: item.distance,
    distanceLabel: formatDistance(item.distance),
    updatedMinutes: parseInt(item.updated) || 10,
    updatedLabel: item.updated,
    statusClass,
    hours: "Hours vary",
    fulfillment: item.note,
    stockDetail: item.note,
    nextStep: nextStepForStatus(item.status),
    tags: buildTags(item),
    actions: [
      { label: "Call" },
      { label: item.status === "Out of stock" ? "Transfer" : "Transfer Rx" },
      {
        label:
          item.status === "In stock" || item.status === "Limited fill"
            ? "Reserve"
            : "Plan next step",
      },
    ],
  };
}

function detectPharmacyType(name) {
  const chains = ["cvs", "walgreens", "rite aid", "walmart", "costco", "kroger"];
  const lower = name.toLowerCase();
  return chains.some((c) => lower.includes(c)) ? "Chain" : "Independent";
}

function nextStepForStatus(status) {
  switch (status) {
    case "In stock":
      return "Call to confirm and send script";
    case "Limited fill":
      return "Call to verify remaining quantity";
    case "Low stock":
      return "Call before sending transfer";
    default:
      return "Check alternative locations";
  }
}

function buildTags(item) {
  const tags = [];
  if (item.confidence >= 0.7) tags.push("High confidence");
  else if (item.confidence >= 0.45) tags.push("Moderate confidence");
  else tags.push("Low confidence");
  tags.push(`${Math.round(item.confidence * 100)}% predicted`);
  if (item.distance <= 2) tags.push("Nearby");
  return tags;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function countStatuses(items) {
  return items.reduce(
    (t, item) => {
      if (item.status === "In stock") t.readyNow += 1;
      else if (item.status === "Limited fill" || item.status === "Low stock") t.backups += 1;
      else t.unavailable += 1;
      return t;
    },
    { readyNow: 0, backups: 0, unavailable: 0 },
  );
}

export function createLiveAdapter(apiBase) {
  const mockClient = createMockPharmaPathClient();

  return {
    _apiBase: apiBase,
    _location: "",

    setLocation(location) {
      this._location = location;
    },

    listMedications() {
      return mockClient.listMedications();
    },

    listScenarios() {
      return demoScenarios;
    },

    findScenario(query) {
      return mockClient.findScenario(query);
    },

    getFilterOptions(opts) {
      return mockClient.getFilterOptions(opts);
    },

    async searchPrescriptionLive(query) {
      const location = this._location;
      if (!location) return null;

      const params = new URLSearchParams({
        medication: query.medication || "",
        location,
        dosage: query.dosage || "",
        formulation: query.formulation || "",
      });

      try {
        const resp = await fetch(`${this._apiBase}/api/search?${params}`, {
          signal: AbortSignal.timeout(12000),
        });

        if (!resp.ok) return null;

        const data = await resp.json();
        const rawResults = data.results || [];
        if (!rawResults.length) return null;

        const results = rawResults.map(decorateAPIResult);
        const sorted = [...results].sort(
          (a, b) =>
            (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9) ||
            a.distanceMiles - b.distanceMiles,
        );

        const recommended = sorted[0] || null;
        const counts = countStatuses(results);

        const queryLabel = [query.medication, query.dosage, query.formulation]
          .filter(Boolean)
          .join(" • ");

        return {
          query,
          scenario: this.findScenario(query),
          results: sorted,
          exactMatches: sorted,
          recommended,
          alternativeMatches: [],
          alternateRecommendation: null,
          summary: {
            queryLabel: queryLabel || "All medications",
            headline: recommended
              ? `${sorted.length} nearby ${pluralize(sorted.length, "pharmacy", "pharmacies")} found for ${query.medication}`
              : `No nearby results for ${query.medication}`,
            body: recommended
              ? `${recommended.pharmacy} is the top match with ${recommended.status.toLowerCase()} status, ${recommended.distanceLabel} away in ${recommended.neighborhood}.`
              : "Try a different location or medication.",
            recommendedBody: recommended
              ? `${recommended.pharmacy} leads with ${recommended.status.toLowerCase()} status and ${Math.round(recommended.confidence * 100)}% predicted availability.`
              : "",
            alternativeBody: "",
            toolbarCopy: `${sorted.length} live ${pluralize(sorted.length, "result")} from nearby pharmacies.`,
            alternativeCopy: "",
            metrics: [
              { label: "Ready now", value: String(counts.readyNow) },
              { label: "Backup routes", value: String(counts.backups) },
              { label: "Unavailable", value: String(counts.unavailable) },
              { label: "Closest lead", value: recommended ? recommended.distanceLabel : "--" },
            ],
            digest: [
              `${counts.readyNow} ready-now, ${counts.backups} backup, ${counts.unavailable} unavailable within search area.`,
              recommended
                ? `${recommended.pharmacy} ranks highest — ${Math.round(recommended.confidence * 100)}% predicted availability.`
                : "No strong match found.",
            ],
            emptyTitle: "No pharmacies found for this search.",
            emptyBody: "The API returned no results for this medication and location.",
            emptySuggestion: "Try a larger city or check that the medication name is correct.",
          },
        };
      } catch (err) {
        console.warn("PharmaPath API error:", err);
        return null;
      }
    },

    searchPrescription(query) {
      return mockClient.searchPrescription(query);
    },
  };
}
