import { createPharmaPathClient } from "./services/pharmapath-client.js";

const client = createPharmaPathClient();
const initialFilters = client.getInitialFilters();

const header = document.querySelector("[data-header]");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
const medicationInput = document.querySelector("#medication-input");
const medicationOptions = document.querySelector("#medication-options");
const locationInput = document.querySelector("#location-input");
const radiusSelect = document.querySelector("#radius-select");
const sortSelect = document.querySelector("#sort-select");
const openNowToggle = document.querySelector("#open-now-toggle");
const searchForm = document.querySelector("#search-form");
const submitButton = searchForm.querySelector('button[type="submit"]');
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDistance(distanceMiles) {
  if (!Number.isFinite(distanceMiles)) {
    return "Distance unavailable";
  }

  return `${distanceMiles.toFixed(1)} mi`;
}

function formatRating(rating, reviewCount) {
  if (!Number.isFinite(rating)) {
    return "Rating unavailable";
  }

  const reviewText =
    Number.isFinite(reviewCount) && reviewCount > 0
      ? ` from ${reviewCount} review${reviewCount === 1 ? "" : "s"}`
      : "";

  return `${rating.toFixed(1)} / 5${reviewText}`;
}

function getSortLabel(sortBy) {
  if (sortBy === "distance") {
    return "closest distance";
  }

  if (sortBy === "rating") {
    return "highest Google rating";
  }

  return "best overall match";
}

function getOpenStatus(place) {
  if (place.open_now === true) {
    return {
      label: "Open now",
      className: "status-in-stock",
      detail: "Google currently marks this pharmacy open.",
    };
  }

  if (place.open_now === false) {
    return {
      label: "Closed now",
      className: "status-out-of-stock",
      detail: "Google currently marks this pharmacy closed.",
    };
  }

  return {
    label: "Hours unavailable",
    className: "status-suggestion",
    detail: "Open/closed status was not returned for this location.",
  };
}

function buildResultActions(place) {
  const actions = [];

  if (place.google_maps_url) {
    actions.push(`
      <a
        class="action-pill"
        href="${escapeHtml(place.google_maps_url)}"
        target="_blank"
        rel="noreferrer"
      >
        Open in Maps
      </a>
    `);
  }

  actions.push(`
    <button
      class="action-pill"
      type="button"
      data-copy-address="${escapeHtml(place.address)}"
      data-pharmacy="${escapeHtml(place.name)}"
    >
      Copy address
    </button>
  `);

  return actions.join("");
}

function buildResultCard(place, medication, guidance = {}, label = "") {
  const status = getOpenStatus(place);
  const labelMarkup = label
    ? `<span class="inline-badge inline-badge-highlight">${escapeHtml(label)}</span>`
    : "";
  const ratingLabel = formatRating(place.rating, place.user_ratings_total);
  const businessStatus = place.business_status ? ` • ${escapeHtml(place.business_status)}` : "";
  const nextStep =
    place.next_step ||
    guidance.recommended_action ||
    "Call to confirm availability before sending the prescription.";
  const matchReason =
    place.match_reason ||
    guidance.summary ||
    `Use this pharmacy as part of the ${medication} search workflow.`;
  const inventoryNote =
    place.inventory_note ||
    guidance.demo_boundary ||
    `Real-time inventory for ${medication} is not yet verified in this demo.`;
  const workflowLabel =
    place.workflow_label || guidance.ranking_focus_label || "Medication guidance";

  return `
    <article class="result-card${label ? " is-recommended" : ""}">
      <div class="result-card-top">
        <div class="result-copy">
          <div class="result-badges">
            ${labelMarkup}
            <span class="inline-badge">${escapeHtml(formatDistance(place.distance_miles))}</span>
            <span class="inline-badge">${escapeHtml(ratingLabel)}</span>
          </div>
          <h4 class="result-title">${escapeHtml(place.name)}</h4>
          <p class="result-subtitle">
            ${escapeHtml(place.address)}${businessStatus}
          </p>
        </div>
        <div class="result-status">
          <span class="status-badge ${escapeHtml(status.className)}">${escapeHtml(
            status.label,
          )}</span>
          <span class="updated-label">${escapeHtml(status.detail)}</span>
        </div>
      </div>

      <div class="result-meta">
        <div class="result-meta-block">
          <span>Lookup source</span>
          <strong>Real Google Places pharmacy</strong>
        </div>
        <div class="result-meta-block">
          <span>Why try this one</span>
          <strong>${escapeHtml(matchReason)}</strong>
        </div>
        <div class="result-meta-block">
          <span>Next question</span>
          <strong>${escapeHtml(nextStep)}</strong>
        </div>
      </div>

      <p class="result-note">
        ${escapeHtml(inventoryNote)}
      </p>

      <div class="result-footer">
        <div class="tag-row">
          <span class="tag-pill">${escapeHtml(place.review_label)}</span>
          <span class="tag-pill">${escapeHtml(status.label)}</span>
          <span class="tag-pill">${escapeHtml(workflowLabel)}</span>
          <span class="tag-pill">Google Places result</span>
        </div>
        <div class="card-actions">
          ${buildResultActions(place)}
        </div>
      </div>
    </article>
  `;
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

function renderSampleSearches(activeId = "") {
  scenarioList.innerHTML = client
    .listSampleSearches()
    .map((sample) => {
      const activeClass = sample.id === activeId ? " is-active" : "";
      return `
        <button
          class="scenario-card${activeClass}"
          type="button"
          data-scenario-id="${escapeHtml(sample.id)}"
        >
          <span>${escapeHtml(sample.label)}</span>
          <strong>${escapeHtml(sample.title)}</strong>
          <p>${escapeHtml(sample.description)}</p>
        </button>
      `;
    })
    .join("");
}

function populateMedicationList() {
  medicationOptions.innerHTML = client
    .listMedicationSuggestions()
    .map((medication) => `<option value="${escapeHtml(medication)}"></option>`)
    .join("");
}

function getFilters() {
  return {
    medication: medicationInput.value.trim(),
    location: locationInput.value.trim(),
    radiusMiles: Number(radiusSelect.value),
    sortBy: sortSelect.value,
    onlyOpenNow: openNowToggle.checked,
  };
}

function setFilters(filters) {
  medicationInput.value = filters.medication || "";
  locationInput.value = filters.location || "";
  radiusSelect.value = String(filters.radiusMiles || 5);
  sortSelect.value = filters.sortBy || "best_match";
  openNowToggle.checked = Boolean(filters.onlyOpenNow);
}

function findMatchingSample(filters) {
  return client.listSampleSearches().find((sample) => {
    const candidate = sample.filters;
    return (
      candidate.medication === filters.medication &&
      candidate.location === filters.location &&
      Number(candidate.radiusMiles) === Number(filters.radiusMiles) &&
      candidate.sortBy === filters.sortBy &&
      Boolean(candidate.onlyOpenNow) === Boolean(filters.onlyOpenNow)
    );
  });
}

function setActionFeedback(message = "", state = "") {
  if (actionFeedbackTimer) {
    clearTimeout(actionFeedbackTimer);
    actionFeedbackTimer = undefined;
  }

  actionFeedback.classList.remove("is-error", "is-loading", "is-success");

  if (!message) {
    actionFeedback.textContent = "";
    return;
  }

  actionFeedback.textContent = message;

  if (state) {
    actionFeedback.classList.add(`is-${state}`);
  }

  if (state === "success") {
    actionFeedbackTimer = window.setTimeout(() => {
      actionFeedback.textContent = "";
      actionFeedback.classList.remove("is-success");
    }, 2400);
  }
}

function setSearchingState(isSearching) {
  submitButton.disabled = isSearching;
  submitButton.textContent = isSearching ? "Searching..." : "Find pharmacies";
  resetButton.disabled = isSearching;
}

function renderRecommended(payload) {
  const recommended = payload.recommended;
  const guidance = payload.guidance || {};
  const guidanceTags = Array.isArray(guidance.tags)
    ? guidance.tags
        .map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`)
        .join("")
    : "";
  const questionMarkup =
    Array.isArray(guidance.questions_to_ask) && guidance.questions_to_ask.length
      ? `
        <ul class="guidance-list">
          ${guidance.questions_to_ask
            .map((question) => `<li>${escapeHtml(question)}</li>`)
            .join("")}
        </ul>
      `
      : "";

  if (!recommended) {
    recommendedCard.innerHTML = `
      <p class="panel-eyebrow">Recommended first step</p>
      <p class="recommended-copy">
        No nearby pharmacy results surfaced for this search. Try widening the radius or using a broader neighborhood or borough.
      </p>
      <div class="guidance-panel">
        <p class="panel-eyebrow">Medication-specific guidance</p>
        <h4 class="guidance-title">${escapeHtml(guidance.title || "Availability guidance")}</h4>
        <p class="guidance-summary">${escapeHtml(
          guidance.summary ||
            "PharmaPath separates the real pharmacy lookup from the medication guidance, even when no nearby result is available.",
        )}</p>
        <p class="guidance-footnote">${escapeHtml(guidance.demo_boundary || payload.disclaimer)}</p>
      </div>
    `;
    return;
  }

  const status = getOpenStatus(recommended);
  const ratingLabel = formatRating(recommended.rating, recommended.user_ratings_total);

  recommendedCard.innerHTML = `
    <div class="recommended-head">
      <div>
        <p class="panel-eyebrow">Recommended first pharmacy to check</p>
        <h3 class="recommended-title">${escapeHtml(recommended.name)}</h3>
        <p class="recommended-subtitle">
          ${escapeHtml(recommended.address)} • ${escapeHtml(
            formatDistance(recommended.distance_miles),
          )} away
        </p>
      </div>
      <span class="status-badge ${escapeHtml(status.className)}">${escapeHtml(
        status.label,
      )}</span>
    </div>

    <p class="recommended-copy">
      ${escapeHtml(
        `${recommended.name} is the first pharmacy to call for ${payload.query.medication} near ${payload.location.formatted_address}.`,
      )}
    </p>

    <div class="highlight-grid">
      <div class="highlight-block">
        <span>Search context</span>
        <strong>${escapeHtml(
          `${payload.query.medication} • ${payload.query.radius_miles} mi radius`,
        )}</strong>
      </div>
      <div class="highlight-block">
        <span>Ranking focus</span>
        <strong>${escapeHtml(guidance.ranking_focus_label || ratingLabel)}</strong>
      </div>
      <div class="highlight-block">
        <span>Next handoff</span>
        <strong>${escapeHtml(
          recommended.next_step ||
            guidance.recommended_action ||
            "Call before sending or transferring the prescription.",
        )}</strong>
      </div>
    </div>

    <div class="guidance-panel">
      <p class="panel-eyebrow">Medication-specific guidance</p>
      <h4 class="guidance-title">${escapeHtml(guidance.title || "Availability guidance")}</h4>
      <p class="guidance-summary">${escapeHtml(guidance.summary || payload.disclaimer)}</p>
      <div class="tag-row">
        ${guidanceTags}
        <span class="tag-pill">Live pharmacy lookup</span>
      </div>
      ${questionMarkup}
      <p class="guidance-footnote">${escapeHtml(
        guidance.demo_boundary || payload.disclaimer,
      )}</p>
    </div>

    <div class="tag-row">
      <span class="tag-pill">${escapeHtml(status.label)}</span>
      <span class="tag-pill">${escapeHtml(recommended.review_label)}</span>
      <span class="tag-pill">${escapeHtml(getSortLabel(payload.query.sort_by))}</span>
    </div>

    <div class="card-actions">
      ${buildResultActions(recommended)}
    </div>
  `;
}

function renderDigest(payload) {
  const guidance = payload.guidance || {};
  const digestItems = [
    guidance.real_signal ||
      `Google Places resolved "${payload.query.location}" to ${payload.location.formatted_address}.`,
    guidance.ranking_focus ||
      `Results are ranked by ${getSortLabel(payload.query.sort_by)} so the first recommendation is easier to explain in the demo.`,
    guidance.recommended_action ||
      `Use PharmaPath to decide who to call first for ${payload.query.medication}, then confirm stock directly.`,
    guidance.demo_boundary ||
      `Real-time inventory for ${payload.query.medication} is not yet verified. PharmaPath is identifying the best pharmacies to contact first.`,
  ];

  if (payload.query.only_open_now) {
    digestItems.push("This search is limited to pharmacies Google marks open now.");
  }

  if (payload.counts.hours_unknown) {
    digestItems.push(
      `${payload.counts.hours_unknown} result${
        payload.counts.hours_unknown === 1 ? "" : "s"
      } did not include live open/closed status from Google.`,
    );
  }

  outcomeDigest.innerHTML = digestItems
    .map((item) => `<div class="digest-item">${escapeHtml(item)}</div>`)
    .join("");
}

function renderPrimaryResults(payload) {
  const primaryResults = payload.results.slice(0, 3);

  resultsToolbarCopy.textContent = `${payload.results.length} real Google pharmacy matches ranked by ${getSortLabel(
    payload.query.sort_by,
  )} within ${payload.query.radius_miles} miles of ${payload.location.formatted_address}.`;

  resultsBody.innerHTML = primaryResults
    .map((place, index) =>
      buildResultCard(
        place,
        payload.query.medication,
        payload.guidance,
        index === 0 ? "Top recommendation" : "",
      ),
    )
    .join("");

  if (primaryResults.length) {
    emptyState.hidden = true;
    return;
  }

  emptyState.hidden = false;
  emptyStateTitle.textContent = "No nearby pharmacy results";
  emptyStateCopy.textContent =
    "PharmaPath could not find pharmacies for this location and filter combination.";
  emptyStateSuggestion.textContent =
    "Try broadening the location text, increasing the radius, or turning off the open-now filter.";
}

function renderAdditionalResults(payload) {
  const overflowResults = payload.results.slice(3);

  if (!overflowResults.length) {
    alternativesSection.hidden = true;
    alternativesBody.innerHTML = "";
    return;
  }

  alternativesSection.hidden = false;
  alternativesCopy.textContent =
    "Use these real backup pharmacies if the top recommendation cannot confirm availability.";
  alternativesBody.innerHTML = overflowResults
    .map((place) => buildResultCard(place, payload.query.medication, payload.guidance, "Backup option"))
    .join("");
}

function renderResponse(payload) {
  const bestRating = payload.results.reduce((current, place) => {
    if (!Number.isFinite(place.rating)) {
      return current;
    }

    return Math.max(current, place.rating);
  }, 0);
  const activeSample = findMatchingSample({
    medication: payload.query.medication,
    location: payload.query.location,
    radiusMiles: payload.query.radius_miles,
    sortBy: payload.query.sort_by,
    onlyOpenNow: payload.query.only_open_now,
  });

  queryChip.textContent = `${payload.query.medication} • ${payload.location.formatted_address}`;
  resultsHeadline.textContent = `${payload.results.length} nearby pharm${
    payload.results.length === 1 ? "acy" : "acies"
  } found for ${payload.query.medication}`;
  resultsSummary.textContent =
    "Pharmacy names, addresses, ratings, and open-now signals come from Google Places. Medication-specific guidance below shapes the call workflow but does not verify stock.";
  scenarioContext.textContent = payload.guidance?.summary || payload.disclaimer;

  renderMetrics([
    { label: "Nearby results", value: String(payload.counts.total) },
    { label: "Open now", value: String(payload.counts.open_now) },
    {
      label: "Top rating",
      value: bestRating ? `${bestRating.toFixed(1)} / 5` : "Unavailable",
    },
    { label: "Search radius", value: `${payload.query.radius_miles} mi` },
  ]);

  renderSampleSearches(activeSample?.id);
  renderRecommended(payload);
  renderDigest(payload);
  renderPrimaryResults(payload);
  renderAdditionalResults(payload);
}

function renderLoadingState(filters) {
  queryChip.textContent = `${filters.medication || "Medication"} • ${
    filters.location || "Location"
  }`;
  resultsHeadline.textContent = "Searching nearby pharmacies...";
  resultsSummary.textContent =
    "Resolving the location and loading real Google Places results.";
  scenarioContext.textContent =
    "Medication-specific guidance is prepared separately from the real pharmacy lookup.";
  renderMetrics([
    { label: "Nearby results", value: "--" },
    { label: "Open now", value: "--" },
    { label: "Top rating", value: "--" },
    { label: "Search radius", value: `${filters.radiusMiles || 5} mi` },
  ]);
  recommendedCard.innerHTML = `
    <p class="panel-eyebrow">Recommended first step</p>
    <p class="recommended-copy">Looking up nearby pharmacies and preparing the best first call.</p>
    <div class="guidance-panel">
      <p class="panel-eyebrow">Medication-specific guidance</p>
      <p class="guidance-summary">The location is being geocoded first, then PharmaPath will layer medication-specific call guidance on top of the real pharmacy list.</p>
    </div>
  `;
  outcomeDigest.innerHTML = `
    <div class="digest-item">The location is being geocoded before nearby pharmacy results are ranked.</div>
    <div class="digest-item">Medication-specific guidance is prepared separately from the live Google pharmacy lookup.</div>
  `;
  resultsToolbarCopy.textContent = "Loading nearby pharmacy results...";
  resultsBody.innerHTML = "";
  alternativesSection.hidden = true;
  alternativesBody.innerHTML = "";
  emptyState.hidden = true;
}

function renderErrorState(message, filters) {
  queryChip.textContent = `${filters.medication || "Medication"} • ${
    filters.location || "Location"
  }`;
  resultsHeadline.textContent = "Search unavailable";
  resultsSummary.textContent = message;
  scenarioContext.textContent =
    "PharmaPath separates live pharmacy lookup from medication guidance. If the real lookup fails, the UI should fail clearly instead of faking availability.";
  renderMetrics([
    { label: "Nearby results", value: "--" },
    { label: "Open now", value: "--" },
    { label: "Top rating", value: "--" },
    { label: "Search radius", value: `${filters.radiusMiles || 5} mi` },
  ]);
  recommendedCard.innerHTML = `
    <p class="panel-eyebrow">Recommended first step</p>
    <p class="recommended-copy">Adjust the medication or location and run the search again.</p>
    <div class="guidance-panel">
      <p class="panel-eyebrow">Medication-specific guidance</p>
      <p class="guidance-summary">No medication guidance is shown as a substitute for the real pharmacy search when the backend returns an error.</p>
    </div>
  `;
  outcomeDigest.innerHTML = `
    <div class="digest-item">No pharmacy results were shown because the backend returned an error.</div>
    <div class="digest-item">This protects the demo from implying live medication availability when the search failed.</div>
  `;
  resultsBody.innerHTML = "";
  alternativesSection.hidden = true;
  alternativesBody.innerHTML = "";
  emptyState.hidden = false;
  emptyStateTitle.textContent = "Unable to load pharmacy results";
  emptyStateCopy.textContent = message;
  emptyStateSuggestion.textContent =
    "Check the location text, expand the radius, or verify that GOOGLE_API_KEY is configured.";
}

async function runSearch(filters = getFilters()) {
  const activeSample = findMatchingSample(filters);

  if (!filters.medication || !filters.location) {
    renderSampleSearches(activeSample?.id);
    renderErrorState("Enter both a medication and a location to search.", filters);
    setActionFeedback("Enter both a medication and a location to search.", "error");
    return;
  }

  renderSampleSearches(activeSample?.id);
  renderLoadingState(filters);
  setSearchingState(true);
  setActionFeedback("Resolving the location and loading nearby pharmacies...", "loading");

  try {
    const response = await client.searchPharmacies(filters);
    renderResponse(response);
    setActionFeedback(
      `Loaded ${response.results.length} nearby pharmacies for ${response.query.medication}.`,
      "success",
    );
  } catch (error) {
    renderErrorState(error.message, filters);
    setActionFeedback(error.message, "error");
  } finally {
    setSearchingState(false);
  }
}

async function copyAddress(address, pharmacy) {
  try {
    await navigator.clipboard.writeText(address);
    setActionFeedback(`Copied ${pharmacy} address.`, "success");
  } catch (error) {
    setActionFeedback("Unable to copy the address on this device.", "error");
  }
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
renderSampleSearches(client.listSampleSearches()[0].id);
renderLoadingState(initialFilters);
setHeaderState();
observeSections();
observeReveals();
runSearch(initialFilters);

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});

scenarioList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scenario-id]");

  if (!button) {
    return;
  }

  const scenario = client
    .listSampleSearches()
    .find((item) => item.id === button.dataset.scenarioId);

  if (!scenario) {
    return;
  }

  setFilters(scenario.filters);
  runSearch(scenario.filters);
});

resetButton.addEventListener("click", () => {
  setFilters(initialFilters);
  runSearch(initialFilters);
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
  const copyButton = event.target.closest("[data-copy-address]");

  if (copyButton) {
    copyAddress(copyButton.dataset.copyAddress, copyButton.dataset.pharmacy);
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
