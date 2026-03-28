import { demoScenarios } from "./data/demo-data.js";
import { createPharmaPathClient } from "./services/pharmapath-client.js";
import { createLiveAdapter } from "./services/api-adapter.js";

// ── Backend configuration ────────────────────────────────────────────────────
// Uses same-origin Vercel serverless functions — no separate backend needed.
const API_BASE = "";

const liveAdapter = createLiveAdapter(API_BASE);
const client = createPharmaPathClient();
const locationInput = document.querySelector("#location-input");

const initialFilters = { ...demoScenarios[0].filters };

const header = document.querySelector("[data-header]");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
const medicationInput = document.querySelector("#medication-input");
const medicationOptions = document.querySelector("#medication-options");
const dosageSelect = document.querySelector("#dosage-select");
const formulationSelect = document.querySelector("#formulation-select");
const availabilitySelect = document.querySelector("#availability-select");
const radiusSelect = document.querySelector("#radius-select");
const sortSelect = document.querySelector("#sort-select");
const alternativesToggle = document.querySelector("#alternatives-toggle");
const searchForm = document.querySelector("#search-form");
const resetButton = document.querySelector("#reset-demo");
const scenarioList = document.querySelector("#scenario-list");
const queryChip = document.querySelector("#query-chip");
const resultsHeadline = document.querySelector("#results-headline");
const resultsSummary = document.querySelector("#results-summary");
const scenarioContext = document.querySelector("#scenario-context");
const summaryMetrics = document.querySelector("#summary-metrics");
const recommendedCard = document.querySelector("#recommended-card");
const outcomeDigest = document.querySelector("#outcome-digest");
const resultsToolbarCopy = document.querySelector("#results-toolbar-copy");
const resultsBody = document.querySelector("#results-body");
const emptyState = document.querySelector("#empty-state");
const emptyStateTitle = document.querySelector("#empty-state-title");
const emptyStateCopy = document.querySelector("#empty-state-copy");
const emptyStateSuggestion = document.querySelector("#empty-state-suggestion");
const alternativesSection = document.querySelector("#alternatives-section");
const alternativesCopy = document.querySelector("#alternatives-copy");
const alternativesBody = document.querySelector("#alternatives-body");
const actionFeedback = document.querySelector("#action-feedback");
const revealNodes = Array.from(document.querySelectorAll("[data-reveal]"));

let actionFeedbackTimer;

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function populateMedicationList() {
  medicationOptions.innerHTML = client
    .listMedications()
    .map((medication) => `<option value="${escapeHtml(medication)}"></option>`)
    .join("");
}

function populateSelect(select, values, label, keepValue = "") {
  select.innerHTML = [`<option value="">${label}</option>`]
    .concat(
      values.map(
        (value) =>
          `<option value="${escapeHtml(value)}" ${
            value === keepValue ? "selected" : ""
          }>${escapeHtml(value)}</option>`,
      ),
    )
    .join("");
}

function updateFilterOptions() {
  const options = client.getFilterOptions({ medication: medicationInput.value });
  populateSelect(dosageSelect, options.dosages, "All doses", dosageSelect.value);
  populateSelect(
    formulationSelect,
    options.formulations,
    "All formulations",
    formulationSelect.value,
  );
}

function getFilters() {
  return {
    medication: medicationInput.value.trim(),
    dosage: dosageSelect.value,
    formulation: formulationSelect.value,
    availabilityMode: availabilitySelect.value,
    radiusMiles: Number(radiusSelect.value),
    sortBy: sortSelect.value,
    includeAlternatives: alternativesToggle.checked,
  };
}

function setFilters(filters) {
  medicationInput.value = filters.medication || "";
  updateFilterOptions();
  dosageSelect.value = filters.dosage || "";
  formulationSelect.value = filters.formulation || "";
  availabilitySelect.value = filters.availabilityMode || "all";
  radiusSelect.value = String(filters.radiusMiles || 5);
  sortSelect.value = filters.sortBy || "smart";
  alternativesToggle.checked = filters.includeAlternatives ?? true;
}

function renderScenarios(activeScenarioId = "") {
  scenarioList.innerHTML = client
    .listScenarios()
    .map((scenario) => {
      const activeClass = scenario.id === activeScenarioId ? " is-active" : "";
      return `
        <button
          class="scenario-card${activeClass}"
          type="button"
          data-scenario-id="${escapeHtml(scenario.id)}"
        >
          <span>${escapeHtml(scenario.label)}</span>
          <strong>${escapeHtml(scenario.title)}</strong>
          <p>${escapeHtml(scenario.description)}</p>
        </button>
      `;
    })
    .join("");
}

function buildActionMarkup(item) {
  return item.actions
    .map(
      (action) => `
        <button
          class="action-pill"
          type="button"
          data-action="${escapeHtml(action.label)}"
          data-pharmacy="${escapeHtml(item.pharmacy)}"
        >
          ${escapeHtml(action.label)}
        </button>
      `,
    )
    .join("");
}

function renderMetrics(metrics) {
  summaryMetrics.innerHTML = metrics
    .map(
      (metric) => `
        <div class="metric-pill">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderRecommended(response) {
  const recommended = response.recommended || response.alternateRecommendation;

  if (!recommended) {
    recommendedCard.innerHTML = `
      <p class="panel-eyebrow">Recommended next step</p>
      <p class="recommended-copy">No nearby recommendation is available in the current demo snapshot.</p>
    `;
    return;
  }

  const isAlternate = Boolean(!response.recommended && response.alternateRecommendation);
  const badgeClass = isAlternate ? "status-suggestion" : recommended.statusClass;
  const introLabel = isAlternate ? "Nearest backup route" : "Recommended next step";

  recommendedCard.innerHTML = `
    <div class="recommended-head">
      <div>
        <p class="panel-eyebrow">${escapeHtml(introLabel)}</p>
        <h3 class="recommended-title">${escapeHtml(recommended.pharmacy)}</h3>
        <p class="recommended-subtitle">
          ${escapeHtml(recommended.neighborhood)} • ${escapeHtml(
            recommended.distanceLabel,
          )} away • ${escapeHtml(recommended.hours)}
        </p>
      </div>
      <span class="status-badge ${escapeHtml(badgeClass)}">${escapeHtml(
        isAlternate ? "Backup route" : recommended.status,
      )}</span>
    </div>

    <p class="recommended-copy">${escapeHtml(
      isAlternate ? response.summary.alternativeBody : response.summary.recommendedBody,
    )}</p>

    <div class="highlight-grid">
      <div class="highlight-block">
        <span>Prescription fit</span>
        <strong>${escapeHtml(
          `${recommended.medication} • ${recommended.dosage} • ${recommended.formulation}`,
        )}</strong>
      </div>
      <div class="highlight-block">
        <span>Fill outlook</span>
        <strong>${escapeHtml(recommended.fulfillment)}</strong>
      </div>
      <div class="highlight-block">
        <span>Next handoff</span>
        <strong>${escapeHtml(recommended.nextStep)}</strong>
      </div>
    </div>

    <div class="tag-row">
      ${recommended.tags
        .map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`)
        .join("")}
    </div>

    <div class="card-actions">
      ${buildActionMarkup(recommended)}
    </div>
  `;
}

function renderDigest(digestItems) {
  outcomeDigest.innerHTML = digestItems
    .map((item) => `<div class="digest-item">${escapeHtml(item)}</div>`)
    .join("");
}

function renderResultCard(item, label = "") {
  const labelMarkup = label
    ? `<span class="inline-badge inline-badge-highlight">${escapeHtml(label)}</span>`
    : "";

  return `
    <article class="result-card${label ? " is-recommended" : ""}">
      <div class="result-card-top">
        <div class="result-copy">
          <div class="result-badges">
            ${labelMarkup}
            <span class="inline-badge">${escapeHtml(item.pharmacyType)}</span>
            <span class="inline-badge">${escapeHtml(item.distanceLabel)} away</span>
          </div>
          <h4 class="result-title">${escapeHtml(item.pharmacy)}</h4>
          <p class="result-subtitle">
            ${escapeHtml(item.neighborhood)} • ${escapeHtml(item.hours)}
          </p>
        </div>
        <div class="result-status">
          <span class="status-badge ${escapeHtml(item.statusClass)}">${escapeHtml(
            item.status,
          )}</span>
          <span class="updated-label">Updated ${escapeHtml(item.updatedLabel)}</span>
        </div>
      </div>

      <div class="result-meta">
        <div class="result-meta-block">
          <span>Prescription fit</span>
          <strong>${escapeHtml(
            `${item.medication} • ${item.dosage} • ${item.formulation}`,
          )}</strong>
        </div>
        <div class="result-meta-block">
          <span>Fill outlook</span>
          <strong>${escapeHtml(item.fulfillment)}</strong>
        </div>
        <div class="result-meta-block">
          <span>Next handoff</span>
          <strong>${escapeHtml(item.nextStep)}</strong>
        </div>
      </div>

      <p class="result-note">${escapeHtml(item.stockDetail)}</p>

      <div class="result-footer">
        <div class="tag-row">
          ${item.tags
            .map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`)
            .join("")}
        </div>
        <div class="card-actions">
          ${buildActionMarkup(item)}
        </div>
      </div>
    </article>
  `;
}

function renderResults(response) {
  resultsToolbarCopy.textContent = response.summary.toolbarCopy;
  resultsBody.innerHTML = response.results
    .map((item, index) =>
      renderResultCard(
        item,
        item.id === response.recommended?.id ? "Best exact match" : "",
      ),
    )
    .join("");

  if (response.results.length) {
    emptyState.hidden = true;
    return;
  }

  emptyState.hidden = false;
  emptyStateTitle.textContent = response.summary.emptyTitle;
  emptyStateCopy.textContent = response.summary.emptyBody;
  emptyStateSuggestion.textContent = response.summary.emptySuggestion;
}

function renderAlternatives(response) {
  if (!response.alternativeMatches.length) {
    alternativesSection.hidden = true;
    alternativesBody.innerHTML = "";
    return;
  }

  alternativesSection.hidden = false;
  alternativesCopy.textContent = response.summary.alternativeCopy;
  alternativesBody.innerHTML = response.alternativeMatches
    .map((item, index) =>
      renderResultCard(item, index === 0 ? "Nearest backup route" : "Backup route"),
    )
    .join("");
}

function renderResponse(response) {
  queryChip.textContent = response.summary.queryLabel;
  resultsHeadline.textContent = response.summary.headline;
  resultsSummary.textContent = response.summary.body;
  scenarioContext.textContent = response.scenario
    ? `Demo story: ${response.scenario.description}`
    : "Manual search mode. Use the results to show how the best route changes with the prescription details.";

  renderMetrics(response.summary.metrics);
  renderRecommended(response);
  renderDigest(response.summary.digest);
  renderResults(response);
  renderAlternatives(response);
}

async function runSearch(filters = getFilters()) {
  const location = locationInput ? locationInput.value.trim() : "";

  // Try live API if a location was entered
  if (location && filters.medication) {
    liveAdapter.setLocation(location);
    resultsHeadline.textContent = "Searching live pharmacies...";
    resultsSummary.textContent = "";

    const liveResponse = await liveAdapter.searchPrescriptionLive(filters);
    if (liveResponse) {
      const activeScenario = client.findScenario(filters);
      renderScenarios(activeScenario?.id);
      renderResponse(liveResponse);
      return;
    }
  }

  // Fall back to mock data
  const activeScenario = client.findScenario(filters);
  const response = client.searchPrescription(filters);
  renderScenarios(activeScenario?.id);
  renderResponse(response);
}

function showActionFeedback(action, pharmacy) {
  if (actionFeedbackTimer) {
    clearTimeout(actionFeedbackTimer);
  }

  actionFeedback.textContent = `Demo action: ${action} at ${pharmacy}. Placeholder only until live integrations are connected.`;

  actionFeedbackTimer = window.setTimeout(() => {
    actionFeedback.textContent = "";
  }, 2800);
}

function setHeaderState() {
  header.classList.toggle("is-scrolled", window.scrollY > 24);
}

function toggleNav(forceState) {
  const shouldOpen =
    typeof forceState === "boolean"
      ? forceState
      : !header.classList.contains("is-open");

  header.classList.toggle("is-open", shouldOpen);
  document.body.classList.toggle("is-nav-open", shouldOpen);
  navToggle.setAttribute("aria-expanded", String(shouldOpen));
}

function observeSections() {
  const sections = Array.from(document.querySelectorAll("[data-section]"));

  const navObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

      if (!visibleEntry) {
        return;
      }

      const activeId = visibleEntry.target.id;
      navLinks.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${activeId}`;
        link.classList.toggle("is-active", isActive);
      });
    },
    {
      threshold: [0.25, 0.45, 0.65],
      rootMargin: "-20% 0px -45% 0px",
    },
  );

  sections.forEach((section) => navObserver.observe(section));
}

function observeReveals() {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.2 },
  );

  revealNodes.forEach((node) => revealObserver.observe(node));
}

populateMedicationList();
setFilters(initialFilters);
renderScenarios(demoScenarios[0].id);
runSearch(initialFilters);
setHeaderState();
observeSections();
observeReveals();

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runSearch();
});

medicationInput.addEventListener("input", () => {
  updateFilterOptions();
});

scenarioList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-scenario-id]");

  if (!button) {
    return;
  }

  const scenario = client
    .listScenarios()
    .find((item) => item.id === button.dataset.scenarioId);

  if (!scenario) {
    return;
  }

  setFilters(scenario.filters);
  await runSearch(scenario.filters);
});

resetButton.addEventListener("click", async () => {
  setFilters(initialFilters);
  await runSearch(initialFilters);
});

window.addEventListener("scroll", setHeaderState, { passive: true });

navToggle.addEventListener("click", () => {
  toggleNav();
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    toggleNav(false);
  });
});

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");

  if (actionButton) {
    showActionFeedback(actionButton.dataset.action, actionButton.dataset.pharmacy);
    return;
  }

  if (header.classList.contains("is-open") && !event.target.closest(".header-shell")) {
    toggleNav(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    toggleNav(false);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("is-ready");
});
