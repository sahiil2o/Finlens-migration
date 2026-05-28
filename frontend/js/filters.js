import { AppState } from "./state.js";
import { applyFiltersEngine } from "./utils/filterEngine.js";
import { calculateSalaryCycles } from "./calculator.js";
import { getAccountMeta } from "./metaStore.js";

// ===============================
// DOM ELEMENTS
// ===============================

let searchInput;
let monthFilter;
let categoryFilter;
let typeFilter;
let sortFilter;

export function initializeFilters() {
  searchInput = document.getElementById("search");
  monthFilter = document.getElementById("monthFilter");
  categoryFilter = document.getElementById("catFilter");
  typeFilter = document.getElementById("typeFilter");
  sortFilter = document.getElementById("sortFilter");

  setupEventListeners();

  populateCategoryFilter();

  populateMonthFilter();
}

// ===============================
// EVENT LISTENERS
// ===============================

function setupEventListeners() {

  searchInput.addEventListener(
    "input",
    applyFilters
  );

  monthFilter.addEventListener(
    "change",
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

  sortFilter.addEventListener(
    "change",
    applyFilters
  );
}

// ===============================
// APPLY FILTERS
// ===============================

export function applyFilters() {
  const search = searchInput.value.toLowerCase().trim();
  const category = categoryFilter.value;
  const type = typeFilter.value;
  const month = monthFilter.value;
  const sortBy = sortFilter.value;
  const accountId = AppState.filters?.accountId || "";

  // Save criteria to state
  AppState.filters = {
    ...AppState.filters,
    search,
    category,
    type,
    month,
    sortBy
  };

  // Run pure filter engine
  const filtered = applyFiltersEngine(AppState.transactions || [], {
    search,
    category,
    type,
    month,
    accountId,
    sortBy
  });

  AppState.filteredTransactions = filtered;

  updateHeaderSortIndicators(sortBy);
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

export function refreshFilters() {

  populateCategoryFilter();

  populateMonthFilter();

  // Restore UI values
  searchInput.value =
    AppState.filters?.search || "";

  monthFilter.value =
    AppState.filters?.month || "";

  categoryFilter.value =
    AppState.filters?.category || "";

  typeFilter.value =
    AppState.filters?.type || "";

  sortFilter.value =
    AppState.filters?.sortBy || "date-desc";

  // Reapply filters
  applyFilters();
}

// ===============================
// MONTH FILTER POPULATION
// ===============================
export function populateMonthFilter() {
  if (!monthFilter) return;

  const accountId = AppState.filters?.accountId || "";
  const transactions = AppState.transactions || [];

  const acctTxns = transactions.filter(t => {
    if (!accountId || accountId === "all") return true;
    if (accountId === "HDFC Credit Card") return t.sourceBank && t.sourceBank.includes("CC");
    return t.sourceBank === accountId;
  });
  if (!acctTxns.length) {
    monthFilter.innerHTML = `<option value="">All cycles</option>`;
    monthFilter.value = "";
    return;
  }

  const isCC = accountId.includes("CC") || accountId === "HDFC Credit Card";
  const isSavings = accountId.includes("Savings");

  const parseDateStr = (dateStr) => {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      let [dd, mm, yyyy] = parts;
      if (yyyy.length === 2) yyyy = "20" + yyyy;
      return new Date(`${yyyy}-${mm}-${dd}`);
    }
    return new Date(dateStr);
  };

  const formatDateLabel = (dateObj) => {
    return dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const options = [];

  if (isCC) {
    // Extract unique statementDate values
    const stmtDates = [...new Set(acctTxns.map(t => t.statementDate))].filter(Boolean);
    
    if (stmtDates.length > 0) {
      // Sort statement dates chronologically descending
      stmtDates.sort((a, b) => parseDateStr(b) - parseDateStr(a));

      for (const stmt of stmtDates) {
        const endDate = parseDateStr(stmt);
        if (isNaN(endDate.getTime())) continue;

        // Start date is 13th of previous month
        const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 13);
        
        // Billing period ends the day before statement date
        const displayEndDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        
        const label = `${formatDateLabel(startDate)} - ${formatDateLabel(displayEndDate)}`;
        options.push({ value: `stmt:${stmt}`, label });
      }
    }
  } else if (isSavings) {
    const savedMeta = getAccountMeta(accountId) || AppState.meta || {};
    const cycles = calculateSalaryCycles(transactions, accountId, savedMeta);
    for (const cycle of cycles) {
      const startStr = cycle.salaryDate.toISOString().split("T")[0];
      const endStr = cycle.endDate.toISOString().split("T")[0];
      
      const label = `${formatDateLabel(cycle.salaryDate)} - ${formatDateLabel(cycle.endDate)}`;
      options.push({ value: `cycle:${startStr}_${endStr}`, label });
    }
  }

  // Fallback to calendar months if not CC/Savings or if they have no cycles
  if (options.length === 0) {
    const months = [...new Set(acctTxns.map(t => {
      if (!t.date) return null;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${year}-${m}`;
    }))].filter(Boolean).sort().reverse();

    for (const m of months) {
      const [year, month] = m.split("-");
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month
      
      const label = `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;
      options.push({ value: `month:${m}`, label });
    }
  }

  // Populate dropdown
  monthFilter.innerHTML = `
    <option value="all">All time</option>
    ${options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join("")}
  `;

  // Always default to the most recent cycle (the first option) on selection/refresh unless "all" or specific is selected
  if (options.length > 0) {
    const currentValue = AppState.filters?.month || "";
    const hasCurrent = options.some(opt => opt.value === currentValue) || currentValue === "all";
    if (hasCurrent) {
      monthFilter.value = currentValue;
    } else {
      monthFilter.value = options[0].value;
      AppState.filters.month = options[0].value;
    }
  } else {
    monthFilter.value = "all";
    AppState.filters.month = "all";
  }
}

// ===============================
// HELPERS
// ===============================

function capitalize(text) {

  return text.charAt(0)
    .toUpperCase()
    + text.slice(1);
}

// ===============================
// DYNAMIC COLUMN-CLICK HEADER SORT
// ===============================
window.sortByHeader = function(column) {
  const sortFilter = document.getElementById("sortFilter");
  if (!sortFilter) return;

  const current = sortFilter.value;

  if (column === "description") {
    if (current === "date-desc") {
      sortFilter.value = "date-asc";
    } else if (current === "date-asc") {
      sortFilter.value = "desc-asc";
    } else if (current === "desc-asc") {
      sortFilter.value = "desc-desc";
    } else {
      sortFilter.value = "date-desc";
    }
  } else if (column === "category") {
    if (current === "cat-asc") {
      sortFilter.value = "cat-desc";
    } else {
      sortFilter.value = "cat-asc";
    }
  } else if (column === "amount") {
    if (current === "amount-desc") {
      sortFilter.value = "amount-asc";
    } else {
      sortFilter.value = "amount-desc";
    }
  }

  // Trigger change event to run applyFilters
  sortFilter.dispatchEvent(new Event("change"));
};

function updateHeaderSortIndicators(sortBy) {
  const thDesc = document.getElementById("th-description");
  const thCat = document.getElementById("th-category");
  const thAmt = document.getElementById("th-amount");

  if (!thDesc || !thCat || !thAmt) return;

  // Reset text
  thDesc.innerHTML = 'Description';
  thCat.innerHTML = 'Category';
  thAmt.innerHTML = 'Amount';

  // Apply arrows or labels
  if (sortBy === "date-desc") {
    thDesc.innerHTML = 'Description <span style="font-size:0.6rem; color:var(--accent2); margin-left:3px; vertical-align:middle;">▼</span>';
  } else if (sortBy === "date-asc") {
    thDesc.innerHTML = 'Description <span style="font-size:0.6rem; color:var(--accent2); margin-left:3px; vertical-align:middle;">▲</span>';
  } else if (sortBy === "desc-asc") {
    thDesc.innerHTML = 'Description <span style="font-size:0.6rem; color:var(--accent2); margin-left:3px; vertical-align:middle;">(A-Z) ▲</span>';
  } else if (sortBy === "desc-desc") {
    thDesc.innerHTML = 'Description <span style="font-size:0.6rem; color:var(--accent2); margin-left:3px; vertical-align:middle;">(Z-A) ▼</span>';
  } else if (sortBy === "cat-asc") {
    thCat.innerHTML = 'Category <span style="font-size:0.6rem; color:var(--accent2); margin-left:3px; vertical-align:middle;">▲</span>';
  } else if (sortBy === "cat-desc") {
    thCat.innerHTML = 'Category <span style="font-size:0.6rem; color:var(--accent2); margin-left:3px; vertical-align:middle;">▼</span>';
  } else if (sortBy === "amount-desc") {
    thAmt.innerHTML = 'Amount <span style="font-size:0.6rem; color:var(--accent2); margin-left:3px; vertical-align:middle;">▼</span>';
  } else if (sortBy === "amount-asc") {
    thAmt.innerHTML = 'Amount <span style="font-size:0.6rem; color:var(--accent2); margin-left:3px; vertical-align:middle;">▲</span>';
  }
}