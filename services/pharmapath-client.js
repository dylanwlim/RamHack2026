import { demoInventory, demoScenarios } from "../data/demo-data.js";

const STATUS_PRIORITY = {
  "In stock": 0,
  "Limited fill": 1,
  "Low stock": 2,
  "Out of stock": 3,
};

const AVAILABILITY_FILTERS = {
  all: () => true,
  viable: (item) => item.status !== "Out of stock",
  ready: (item) => item.status === "In stock",
};

function normalize(value = "") {
  return value.trim().toLowerCase();
}

function uniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function formatMinutes(minutes) {
  return `${minutes} min ago`;
}

function formatDistance(distance) {
  return `${distance.toFixed(1)} mi`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function decorateItem(item) {
  return {
    ...item,
    updatedLabel: formatMinutes(item.updatedMinutes),
    distanceLabel: formatDistance(item.distanceMiles),
    statusClass: `status-${item.status.toLowerCase().replaceAll(" ", "-")}`,
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

const inventory = demoInventory.map(decorateItem);

function matchesMedication(item, medication) {
  if (!medication) {
    return true;
  }

  return normalize(item.medication).includes(normalize(medication));
}

function matchesExactPrescription(item, query) {
  const dosageMatches = query.dosage
    ? normalize(item.dosage) === normalize(query.dosage)
    : true;
  const formulationMatches = query.formulation
    ? normalize(item.formulation) === normalize(query.formulation)
    : true;

  return matchesMedication(item, query.medication) && dosageMatches && formulationMatches;
}

function isAlternativeMatch(item, query) {
  if (!query.medication || (!query.dosage && !query.formulation)) {
    return false;
  }

  if (!matchesMedication(item, query.medication)) {
    return false;
  }

  return !matchesExactPrescription(item, query);
}

function smartScore(item) {
  return (
    (STATUS_PRIORITY[item.status] ?? 9) * 100 +
    item.distanceMiles * 8 +
    item.updatedMinutes * 0.25
  );
}

const SORTERS = {
  smart: (left, right) =>
    smartScore(left) - smartScore(right) ||
    left.distanceMiles - right.distanceMiles ||
    left.updatedMinutes - right.updatedMinutes,
  closest: (left, right) =>
    left.distanceMiles - right.distanceMiles ||
    (STATUS_PRIORITY[left.status] ?? 9) - (STATUS_PRIORITY[right.status] ?? 9),
  freshest: (left, right) =>
    left.updatedMinutes - right.updatedMinutes ||
    (STATUS_PRIORITY[left.status] ?? 9) - (STATUS_PRIORITY[right.status] ?? 9),
};

function sortItems(items, sortBy = "smart") {
  const sorter = SORTERS[sortBy] || SORTERS.smart;
  return [...items].sort(sorter);
}

function countStatuses(items) {
  return items.reduce(
    (totals, item) => {
      if (item.status === "In stock") {
        totals.readyNow += 1;
      } else if (item.status === "Limited fill" || item.status === "Low stock") {
        totals.backups += 1;
      } else {
        totals.unavailable += 1;
      }

      return totals;
    },
    { readyNow: 0, backups: 0, unavailable: 0 },
  );
}

function buildQueryLabel(query) {
  const parts = [query.medication, query.dosage, query.formulation].filter(Boolean);
  return parts.length ? parts.join(" • ") : "All medications";
}

function buildHeadline(exactMatches, recommended, query) {
  if (recommended?.status === "In stock") {
    return `${exactMatches.length} exact ${pluralize(
      exactMatches.length,
      "match",
      "matches",
    )} found within ${query.radiusMiles} miles`;
  }

  if (exactMatches.length) {
    return `No ready-now exact fill. Ranked backup options remain nearby`;
  }

  return `No exact match in the current ${query.radiusMiles}-mile search radius`;
}

function buildBody(recommended, query) {
  if (!recommended) {
    return "The current demo filters do not surface an exact nearby recommendation.";
  }

  return `${recommended.pharmacy} is the clearest next step for ${buildQueryLabel(
    query,
  )}. ${recommended.fulfillment}. ${recommended.distanceLabel} away in ${
    recommended.neighborhood
  }, refreshed ${recommended.updatedLabel}.`;
}

function buildAlternativeBody(alternative, query) {
  if (!alternative) {
    return "";
  }

  return `${alternative.pharmacy} is the nearest backup route for ${query.medication}. It has ${alternative.dosage} ${alternative.formulation.toLowerCase()} available ${alternative.distanceLabel} away.`;
}

function buildDigest(counts, recommended, alternateRecommendation, query) {
  const digest = [
    `${counts.readyNow} ready-now ${pluralize(
      counts.readyNow,
      "match",
      "matches",
    )}, ${counts.backups} backup ${pluralize(
      counts.backups,
      "route",
    )}, and ${counts.unavailable} unavailable ${pluralize(
      counts.unavailable,
      "location",
    )} within ${query.radiusMiles} miles.`,
  ];

  if (recommended) {
    digest.push(
      `${recommended.pharmacy} leads because it pairs the best stock outlook with a short trip and fresh inventory signal.`,
    );
  }

  if (alternateRecommendation) {
    digest.push(
      `${alternateRecommendation.pharmacy} keeps the handoff moving if the exact prescription is unavailable or needs a reviewed fallback.`,
    );
  }

  return digest;
}

function buildEmptyState(query, exactMatches, visibleMatches, alternateRecommendation) {
  if (exactMatches.length && !visibleMatches.length && query.availabilityMode !== "all") {
    return {
      title: "No exact matches satisfy the current availability filter.",
      body: `There are ${exactMatches.length} exact ${pluralize(
        exactMatches.length,
        "result",
      )} in the current radius, but none are marked as ready under this filter.`,
      suggestion:
        "Switch the availability focus back to all statuses or viable options to show the full handoff story.",
    };
  }

  if (!exactMatches.length && alternateRecommendation) {
    return {
      title: "No exact match surfaced in this radius.",
      body: "PharmaPath can still show a nearby fallback route so the care team has a next conversation to start.",
      suggestion: `${alternateRecommendation.pharmacy} offers the nearest alternative path for this medication.`,
    };
  }

  return {
    title: "No nearby match in the current demo snapshot.",
    body: "Try widening the radius, relaxing the availability focus, or switching to one of the preset scenarios.",
    suggestion: "The backup route panel will populate automatically when a viable alternative exists.",
  };
}

/**
 * Adapter contract for future integrations:
 * - listMedications()
 * - listScenarios()
 * - getFilterOptions({ medication })
 * - searchPrescription(query)
 */
export function createMockPharmaPathClient() {
  return {
    listMedications() {
      return uniqueValues(inventory, "medication");
    },

    listScenarios() {
      return demoScenarios;
    },

    findScenario(query) {
      return demoScenarios.find(
        (scenario) =>
          scenario.filters.medication === query.medication &&
          scenario.filters.dosage === query.dosage &&
          scenario.filters.formulation === query.formulation &&
          Number(scenario.filters.radiusMiles) === Number(query.radiusMiles),
      );
    },

    getFilterOptions({ medication = "" } = {}) {
      const scopedInventory = medication
        ? inventory.filter((item) => matchesMedication(item, medication))
        : inventory;

      return {
        dosages: uniqueValues(scopedInventory, "dosage"),
        formulations: uniqueValues(scopedInventory, "formulation"),
      };
    },

    searchPrescription(query) {
      const availabilityMatcher =
        AVAILABILITY_FILTERS[query.availabilityMode] || AVAILABILITY_FILTERS.all;
      const withinRadius = (item) => item.distanceMiles <= Number(query.radiusMiles || 5);

      const exactMatches = sortItems(
        inventory.filter(
          (item) => withinRadius(item) && matchesExactPrescription(item, query),
        ),
        query.sortBy,
      );

      const visibleMatches = exactMatches.filter(availabilityMatcher);
      const alternativeMatches = query.includeAlternatives
        ? sortItems(
            inventory.filter(
              (item) =>
                withinRadius(item) &&
                availabilityMatcher(item) &&
                isAlternativeMatch(item, query),
            ),
            "smart",
          )
        : [];

      const recommended = sortItems(exactMatches, "smart")[0] || null;
      const alternateRecommendation = alternativeMatches[0] || null;
      const counts = countStatuses(exactMatches);
      const scenario = this.findScenario(query);
      const emptyState = buildEmptyState(
        query,
        exactMatches,
        visibleMatches,
        alternateRecommendation,
      );

      const summary = {
        queryLabel: buildQueryLabel(query),
        headline: buildHeadline(exactMatches, recommended, query),
        body: buildBody(recommended, query),
        recommendedBody: buildBody(recommended, query),
        alternativeBody: buildAlternativeBody(alternateRecommendation, query),
        toolbarCopy: `${exactMatches.length} exact ${pluralize(
          exactMatches.length,
          "snapshot",
        )} sorted by ${
          query.sortBy === "closest"
            ? "distance"
            : query.sortBy === "freshest"
              ? "most recent update"
              : "best match"
        }.`,
        alternativeCopy: alternativeMatches.length
          ? `${alternativeMatches.length} nearby backup ${pluralize(
              alternativeMatches.length,
              "route",
            )} surfaced because the exact handoff may still need help.`
          : "",
        metrics: [
          { label: "Ready now", value: String(counts.readyNow) },
          { label: "Backup routes", value: String(counts.backups) },
          { label: "Unavailable", value: String(counts.unavailable) },
          {
            label: "Closest lead",
            value: recommended ? recommended.distanceLabel : "--",
          },
        ],
        digest: buildDigest(counts, recommended, alternateRecommendation, query),
        emptyTitle: emptyState.title,
        emptyBody: emptyState.body,
        emptySuggestion: emptyState.suggestion,
      };

      return {
        query,
        scenario,
        results: visibleMatches,
        exactMatches,
        recommended,
        alternativeMatches,
        alternateRecommendation,
        summary,
      };
    },
  };
}

export function createPharmaPathClient({ adapter } = {}) {
  return adapter || createMockPharmaPathClient();
}
