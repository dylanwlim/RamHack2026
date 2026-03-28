// ── API Configuration ────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";

// ── Mock inventory (fallback when backend is offline) ────────────────────────
const inventory = [
  {
    pharmacy: "Greenline Community Pharmacy",
    neighborhood: "Williamsburg",
    distance: 0.7,
    medication: "Adderall XR",
    dosage: "20 mg",
    formulation: "XR capsule",
    status: "In stock",
    note: "30-day fill ready now",
    updated: "8 min ago",
  },
  {
    pharmacy: "Walgreens",
    neighborhood: "Park Slope",
    distance: 1.4,
    medication: "Adderall XR",
    dosage: "20 mg",
    formulation: "XR capsule",
    status: "Limited fill",
    note: "14 capsules available",
    updated: "16 min ago",
  },
  {
    pharmacy: "CVS Pharmacy",
    neighborhood: "Brooklyn Heights",
    distance: 2.1,
    medication: "Adderall XR",
    dosage: "20 mg",
    formulation: "XR capsule",
    status: "Low stock",
    note: "Call before transfer",
    updated: "11 min ago",
  },
  {
    pharmacy: "CityCare Rx",
    neighborhood: "SoHo",
    distance: 4.3,
    medication: "Adderall XR",
    dosage: "20 mg",
    formulation: "XR capsule",
    status: "Out of stock",
    note: "Backorder flagged",
    updated: "27 min ago",
  },
  {
    pharmacy: "Neighborhood Rx",
    neighborhood: "Chelsea",
    distance: 1.8,
    medication: "Adderall XR",
    dosage: "10 mg",
    formulation: "XR capsule",
    status: "In stock",
    note: "Full 30-day fill confirmed",
    updated: "7 min ago",
  },
  {
    pharmacy: "Union Square Drug",
    neighborhood: "Union Square",
    distance: 2.4,
    medication: "Adderall XR",
    dosage: "10 mg",
    formulation: "XR capsule",
    status: "Limited fill",
    note: "10 capsules on shelf",
    updated: "14 min ago",
  },
  {
    pharmacy: "Harborview Pharmacy",
    neighborhood: "Long Island City",
    distance: 1.1,
    medication: "Ozempic",
    dosage: "1 mg",
    formulation: "Injectable pen",
    status: "Limited fill",
    note: "One pen reserved today",
    updated: "5 min ago",
  },
  {
    pharmacy: "CareHub Uptown",
    neighborhood: "Upper West Side",
    distance: 3.8,
    medication: "Ozempic",
    dosage: "1 mg",
    formulation: "Injectable pen",
    status: "In stock",
    note: "Two pens available",
    updated: "12 min ago",
  },
  {
    pharmacy: "Walgreens",
    neighborhood: "Astoria",
    distance: 2.6,
    medication: "Ozempic",
    dosage: "1 mg",
    formulation: "Injectable pen",
    status: "Out of stock",
    note: "Next shipment pending",
    updated: "18 min ago",
  },
  {
    pharmacy: "Lenox Apothecary",
    neighborhood: "Harlem",
    distance: 4.2,
    medication: "Ozempic",
    dosage: "1 mg",
    formulation: "Injectable pen",
    status: "Low stock",
    note: "Confirm before sending script",
    updated: "9 min ago",
  },
  {
    pharmacy: "Prospect Pharmacy",
    neighborhood: "Prospect Heights",
    distance: 0.9,
    medication: "Amoxicillin",
    dosage: "500 mg",
    formulation: "Capsule",
    status: "In stock",
    note: "Same-day fill window open",
    updated: "6 min ago",
  },
  {
    pharmacy: "Brooklyn Family Rx",
    neighborhood: "Bushwick",
    distance: 2.2,
    medication: "Amoxicillin",
    dosage: "500 mg",
    formulation: "Capsule",
    status: "In stock",
    note: "Plenty of inventory",
    updated: "13 min ago",
  },
  {
    pharmacy: "Grand Street Drug",
    neighborhood: "Lower East Side",
    distance: 3.1,
    medication: "Amoxicillin",
    dosage: "500 mg",
    formulation: "Capsule",
    status: "Low stock",
    note: "Last few bottles on hold",
    updated: "15 min ago",
  },
  {
    pharmacy: "Midtown Scripts",
    neighborhood: "Midtown East",
    distance: 5,
    medication: "Amoxicillin",
    dosage: "500 mg",
    formulation: "Capsule",
    status: "Limited fill",
    note: "Partial course ready",
    updated: "20 min ago",
  },
  {
    pharmacy: "Parkview Rx",
    neighborhood: "Cobble Hill",
    distance: 0.6,
    medication: "Sertraline",
    dosage: "50 mg",
    formulation: "Tablet",
    status: "In stock",
    note: "90-day supply available",
    updated: "4 min ago",
  },
  {
    pharmacy: "East River Pharmacy",
    neighborhood: "DUMBO",
    distance: 1.7,
    medication: "Sertraline",
    dosage: "50 mg",
    formulation: "Tablet",
    status: "In stock",
    note: "Generic ready for pickup",
    updated: "10 min ago",
  },
  {
    pharmacy: "Clinton Wellness Pharmacy",
    neighborhood: "Hell's Kitchen",
    distance: 4.5,
    medication: "Sertraline",
    dosage: "50 mg",
    formulation: "Tablet",
    status: "Low stock",
    note: "48 tablets left",
    updated: "17 min ago",
  },
  {
    pharmacy: "CVS Pharmacy",
    neighborhood: "Murray Hill",
    distance: 5.2,
    medication: "Sertraline",
    dosage: "50 mg",
    formulation: "Tablet",
    status: "Out of stock",
    note: "Transfer recommended",
    updated: "22 min ago",
  },
  {
    pharmacy: "Atlantic Pharmacy",
    neighborhood: "Downtown Brooklyn",
    distance: 1.2,
    medication: "Metformin",
    dosage: "500 mg",
    formulation: "ER tablet",
    status: "In stock",
    note: "Full refill available",
    updated: "9 min ago",
  },
  {
    pharmacy: "Flatiron Care Rx",
    neighborhood: "Flatiron",
    distance: 4.6,
    medication: "Metformin",
    dosage: "500 mg",
    formulation: "ER tablet",
    status: "In stock",
    note: "Ready within 30 minutes",
    updated: "19 min ago",
  },
  {
    pharmacy: "Queens Community Pharmacy",
    neighborhood: "Sunnyside",
    distance: 5.8,
    medication: "Metformin",
    dosage: "500 mg",
    formulation: "ER tablet",
    status: "Limited fill",
    note: "Two-week supply available",
    updated: "21 min ago",
  },
  {
    pharmacy: "Rite Aid",
    neighborhood: "Harlem",
    distance: 7.1,
    medication: "Metformin",
    dosage: "500 mg",
    formulation: "ER tablet",
    status: "Out of stock",
    note: "Awaiting wholesaler restock",
    updated: "24 min ago",
  },
  {
    pharmacy: "Northside Pharmacy",
    neighborhood: "Greenpoint",
    distance: 1.9,
    medication: "Albuterol",
    dosage: "90 mcg",
    formulation: "Inhaler",
    status: "In stock",
    note: "Metered dose inhaler available",
    updated: "8 min ago",
  },
  {
    pharmacy: "CityMed Pharmacy",
    neighborhood: "Gramercy",
    distance: 4.1,
    medication: "Albuterol",
    dosage: "90 mcg",
    formulation: "Inhaler",
    status: "Limited fill",
    note: "One inhaler left",
    updated: "13 min ago",
  },
];

let liveResults = null; // holds API results when backend is available
let backendAvailable = false;

const initialFilters = {
  medication: "Adderall XR",
  dosage: "20 mg",
  formulation: "XR capsule",
};

const statusRank = {
  "In stock": 0,
  "Limited fill": 1,
  "Low stock": 2,
  "Out of stock": 3,
};

const medicationInput = document.querySelector("#medication-input");
const dosageSelect = document.querySelector("#dosage-select");
const formulationSelect = document.querySelector("#formulation-select");
const medicationOptions = document.querySelector("#medication-options");
const searchForm = document.querySelector("#search-form");
const resetButton = document.querySelector("#reset-demo");
const resultsBody = document.querySelector("#results-body");
const resultsSummary = document.querySelector("#results-summary");
const emptyState = document.querySelector("#empty-state");
const quickPicks = Array.from(document.querySelectorAll(".quick-pick"));

function uniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function populateMedicationList() {
  medicationOptions.innerHTML = uniqueValues(inventory, "medication")
    .map((medication) => `<option value="${medication}"></option>`)
    .join("");
}

function populateSelect(select, values, label, keepValue = "") {
  const options = [`<option value="">${label}</option>`]
    .concat(
      values.map(
        (value) =>
          `<option value="${value}" ${
            value === keepValue ? "selected" : ""
          }>${value}</option>`,
      ),
    )
    .join("");

  select.innerHTML = options;
}

function updateFilterOptions() {
  const medication = normalize(medicationInput.value);
  const scopedInventory = medication
    ? inventory.filter((item) => normalize(item.medication).includes(medication))
    : inventory;

  populateSelect(
    dosageSelect,
    uniqueValues(scopedInventory, "dosage"),
    "All doses",
    dosageSelect.value,
  );

  populateSelect(
    formulationSelect,
    uniqueValues(scopedInventory, "formulation"),
    "All formulations",
    formulationSelect.value,
  );
}

function getFilters() {
  return {
    medication: medicationInput.value.trim(),
    dosage: dosageSelect.value,
    formulation: formulationSelect.value,
  };
}

function filterInventory(filters) {
  const medication = normalize(filters.medication);
  const dosage = normalize(filters.dosage);
  const formulation = normalize(filters.formulation);

  return inventory
    .filter((item) => {
      const matchesMedication = medication
        ? normalize(item.medication).includes(medication)
        : true;
      const matchesDosage = dosage
        ? normalize(item.dosage) === dosage
        : true;
      const matchesFormulation = formulation
        ? normalize(item.formulation) === formulation
        : true;

      return matchesMedication && matchesDosage && matchesFormulation;
    })
    .sort((left, right) => {
      const rankDiff = statusRank[left.status] - statusRank[right.status];
      return rankDiff === 0 ? left.distance - right.distance : rankDiff;
    });
}

function summaryText(results, filters) {
  if (!results.length) {
    return "No pharmacies match the current prescription details in this demo snapshot.";
  }

  const inStock = results.filter((item) => item.status === "In stock").length;
  const limited = results.filter((item) => item.status === "Limited fill").length;
  const low = results.filter((item) => item.status === "Low stock").length;
  const context = [filters.medication, filters.dosage, filters.formulation]
    .filter(Boolean)
    .join(" • ");

  const coverage = [];
  if (inStock) coverage.push(`${inStock} ready now`);
  if (limited) coverage.push(`${limited} partial`);
  if (low) coverage.push(`${low} low stock`);

  const descriptor = context ? ` for ${context}` : "";
  return `Showing ${results.length} pharmacy snapshots${descriptor}. ${coverage.join(
    ", ",
  )}.`;
}

function confidenceHTML(item) {
  const conf = item.confidence;
  if (conf == null) return '<span class="updated-time">—</span>';

  const pct = Math.round(conf * 100);
  const tier =
    pct >= 70 ? "high" : pct >= 45 ? "medium" : pct >= 25 ? "low" : "none";

  return `
    <div class="confidence-cell">
      <span class="confidence-label">${pct}% likely</span>
      <div class="confidence-bar">
        <div class="confidence-bar-fill ${tier}" style="width:${pct}%"></div>
      </div>
    </div>`;
}

function renderResults(results, filters) {
  resultsSummary.textContent = summaryText(results, filters);

  if (!results.length) {
    resultsBody.innerHTML = "";
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  const bestMatchIndex = results.findIndex((item) => item.status === "In stock");

  resultsBody.innerHTML = results
    .map((item, index) => {
      const statusClass = `status-${item.status
        .toLowerCase()
        .replaceAll(" ", "-")}`;

      return `
        <article class="result-row">
          <div class="result-stack">
            <span class="pharmacy-title">${item.pharmacy}</span>
            <span class="result-subline">${item.neighborhood} • ${item.distance.toFixed(
              1,
            )} mi away</span>
            ${
              index === bestMatchIndex
                ? '<span class="best-match">Best nearby match</span>'
                : ""
            }
          </div>
          <div class="result-stack">
            <span class="prescription-title">${item.medication}</span>
            <span class="result-subline">${item.dosage} • ${item.formulation}</span>
          </div>
          <div class="result-stack">
            <span class="status-badge ${statusClass}">${item.status}</span>
            <span class="status-note">${item.note}</span>
          </div>
          ${confidenceHTML(item)}
          <span class="updated-time">${item.updated}</span>
        </article>
      `;
    })
    .join("");
}

function setFilters(filters) {
  medicationInput.value = filters.medication || "";
  updateFilterOptions();
  dosageSelect.value = filters.dosage || "";
  formulationSelect.value = filters.formulation || "";
  quickPicks.forEach((button) => {
    const active =
      button.dataset.medication === (filters.medication || "") &&
      button.dataset.dosage === (filters.dosage || "") &&
      button.dataset.formulation === (filters.formulation || "");

    button.classList.toggle("active", active);
  });
}

function applyFilters(filters = getFilters()) {
  renderResults(filterInventory(filters), filters);
}

// ── API integration ──────────────────────────────────────────────────────────

const locationInput = document.querySelector("#location-input");

async function checkBackend() {
  try {
    const resp = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (resp.ok) {
      backendAvailable = true;
      resultsSummary.textContent = "Backend connected. Enter a location to search live pharmacies.";
    }
  } catch {
    backendAvailable = false;
  }
}

async function searchAPI(filters) {
  const location = locationInput ? locationInput.value.trim() : "";
  if (!location) return null;

  const params = new URLSearchParams({
    medication: filters.medication,
    location,
    dosage: filters.dosage || "",
    formulation: filters.formulation || "",
  });

  try {
    resultsSummary.textContent = "Searching pharmacies...";
    const resp = await fetch(`${API_BASE}/api/search?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.results || [];
    }
  } catch {
    // Backend unreachable — fall back to mock
  }
  return null;
}

// ── Initialization ───────────────────────────────────────────────────────────

populateMedicationList();
setFilters(initialFilters);
applyFilters(initialFilters);
checkBackend();

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  quickPicks.forEach((button) => button.classList.remove("active"));

  const filters = getFilters();

  // Try live API if a location was entered
  if (backendAvailable && locationInput && locationInput.value.trim()) {
    const apiResults = await searchAPI(filters);
    if (apiResults) {
      liveResults = apiResults;
      renderResults(apiResults, filters);
      return;
    }
  }

  // Fall back to mock data
  liveResults = null;
  applyFilters();
});

medicationInput.addEventListener("input", () => {
  updateFilterOptions();
});

resetButton.addEventListener("click", () => {
  setFilters(initialFilters);
  applyFilters(initialFilters);
});

quickPicks.forEach((button) => {
  button.addEventListener("click", () => {
    const filters = {
      medication: button.dataset.medication,
      dosage: button.dataset.dosage,
      formulation: button.dataset.formulation,
    };

    setFilters(filters);
    applyFilters(filters);
  });
});

window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("is-ready");
});
