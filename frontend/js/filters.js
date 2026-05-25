import { AppState } from "./state.js";
import { renderTable } from "./table.js";
import { renderSummary } from "./summary.js";
import { renderCharts } from "./charts.js";

// ===============================
// DOM ELEMENTS
// ===============================

const searchInput =
  document.getElementById("search");

const categoryFilter =
  document.getElementById("catFilter");

const typeFilter =
  document.getElementById("typeFilter");

// ===============================
// INITIALIZE FILTERS
// ===============================

export function initializeFilters() {

  setupEventListeners();

  populateCategoryFilter();
}

// ===============================
// EVENT LISTENERS
// ===============================

function setupEventListeners() {

  searchInput.addEventListener(
    "input",
    applyFilters
  );

  categoryFilter.addEventListener(
    "change",
    applyFilters
  );

  typeFilter.addEventListener(
    "change",
    applyFilters
  );
}

// ===============================
// APPLY FILTERS
// ===============================

export function applyFilters() {

  const search =
    searchInput.value
      .toLowerCase()
      .trim();

  const category =
    categoryFilter.value;

  const type =
    typeFilter.value;

  // ===============================
  // SAVE FILTER STATE
  // ===============================

  AppState.filters = {
    search,
    category,
    type
  };

  // ===============================
  // START WITH ALL TRANSACTIONS
  // ===============================

  let filtered =
    [...AppState.transactions];

  // ===============================
  // SEARCH FILTER
  // ===============================

  if (search) {

    filtered = filtered.filter(
      transaction => {

        const description =
          transaction.description || "";

        return description
          .toLowerCase()
          .includes(search);
      }
    );
  }

  // ===============================
  // CATEGORY FILTER
  // ===============================

  if (category) {

    filtered = filtered.filter(
      transaction =>

        transaction.category
        === category
    );
  }

  // ===============================
  // TYPE FILTER
  // ===============================

  if (type) {

    filtered = filtered.filter(
      transaction =>

        transaction.type
        === type
    );
  }

  // ===============================
  // UPDATE FILTERED STATE
  // ===============================

  AppState.filteredTransactions =
    filtered;

  // ===============================
  // RE-RENDER UI
  // ===============================

  renderTable();

  renderSummary();

  renderCharts();
}

// ===============================
// CATEGORY DROPDOWN
// ===============================

export function populateCategoryFilter() {

  // Preserve current selection
  const currentValue =
    categoryFilter.value;

  // ===============================
  // UNIQUE CATEGORIES
  // ===============================

  const categories =
    [...new Set(

      AppState.transactions

        .map(t => t.category)

        .filter(Boolean)

    )].sort();

  // ===============================
  // REBUILD DROPDOWN
  // ===============================

  categoryFilter.innerHTML = `
    <option value="">
      All categories
    </option>

    ${categories.map(category => `

      <option value="${category}">
        ${capitalize(category)}
      </option>

    `).join("")}
  `;

  // ===============================
  // RESTORE SELECTION
  // ===============================

  if (
    categories.includes(
      currentValue
    )
  ) {

    categoryFilter.value =
      currentValue;
  }
}

// ===============================
// REAPPLY FILTERS AFTER POLLING
// ===============================

export function refreshFilters() {

  populateCategoryFilter();

  // Restore UI values
  searchInput.value =
    AppState.filters?.search || "";

  categoryFilter.value =
    AppState.filters?.category || "";

  typeFilter.value =
    AppState.filters?.type || "";

  // Reapply filters
  applyFilters();
}

// ===============================
// HELPERS
// ===============================

function capitalize(text) {

  return text.charAt(0)
    .toUpperCase()
    + text.slice(1);
}