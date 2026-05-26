import { AppState } from "./state.js";
import { renderTable } from "./table.js";
import { renderSummary } from "./summary.js";
import { renderCharts } from "./charts.js";
import { renderTrends } from "./trends.js";

// ===============================
// DOM ELEMENTS
// ===============================

const searchInput =
  document.getElementById("search");

const monthFilter =
  document.getElementById("monthFilter");

const categoryFilter =
  document.getElementById("catFilter");

const typeFilter =
  document.getElementById("typeFilter");

const sortFilter =
  document.getElementById("sortFilter");

export function initializeFilters() {

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

  const search =
    searchInput.value
      .toLowerCase()
      .trim();

  const category =
    categoryFilter.value;

  const type =
    typeFilter.value;

  const month =
    monthFilter.value;

  const sortBy =
    sortFilter.value;

  // ===============================
  // SAVE FILTER STATE
  // ===============================

  AppState.filters = {
    ...AppState.filters,
    search,
    category,
    type,
    month,
    sortBy
  };

  // ===============================
  // START WITH ALL TRANSACTIONS
  // ===============================

  let filtered =
    [...AppState.transactions];

  // ===============================
  // MONTH / DATE SLICER FILTER
  // ===============================
  if (month) {
    if (month.startsWith("stmt:")) {
      const targetStmt = month.replace("stmt:", "");
      filtered = filtered.filter(t => t.statementDate === targetStmt);
    } else if (month.startsWith("month:")) {
      const targetMonth = month.replace("month:", "");
      filtered = filtered.filter(t => {
        if (!t.date) return false;
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return false;
        const year = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${m}` === targetMonth;
      });
    }
  }

  // ===============================
  // ACCOUNT / CARD FILTER
  // ===============================

  const accountId = AppState.filters?.accountId || "";
  if (accountId) {
    filtered = filtered.filter(t => t.sourceBank === accountId);
  }

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
  // SORT TRANSACTIONS
  // ===============================
  if (sortBy === "date-asc") {
    filtered.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return da - db;
    });
  } else if (sortBy === "date-desc") {
    filtered.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });
  } else if (sortBy === "amount-desc") {
    filtered.sort((a, b) => Number(b.amount) - Number(a.amount));
  } else if (sortBy === "amount-asc") {
    filtered.sort((a, b) => Number(a.amount) - Number(b.amount));
  } else if (sortBy === "desc-asc") {
    filtered.sort((a, b) => (a.description || "").localeCompare(b.description || ""));
  } else if (sortBy === "desc-desc") {
    filtered.sort((a, b) => (b.description || "").localeCompare(a.description || ""));
  } else if (sortBy === "cat-asc") {
    filtered.sort((a, b) => (a.category || "other").localeCompare(b.category || "other"));
  } else if (sortBy === "cat-desc") {
    filtered.sort((a, b) => (b.category || "other").localeCompare(a.category || "other"));
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

  renderTrends();

  // ===============================
  // UPDATE HEADER ARROWS
  // ===============================
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

  const acctTxns = transactions.filter(t => !accountId || t.sourceBank === accountId);
  if (!acctTxns.length) {
    monthFilter.innerHTML = `<option value="">All cycles</option>`;
    monthFilter.value = "";
    return;
  }

  const isCC = accountId.includes("CC");

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
        
        const label = `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;
        options.push({ value: `stmt:${stmt}`, label });
      }
    }
  }

  // Fallback to calendar months if not CC or if CC has no statement dates
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
    ${options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join("")}
  `;

  // Always default to the most recent cycle (the first option) on selection/refresh
  if (options.length > 0) {
    const currentValue = AppState.filters?.month || "";
    const hasCurrent = options.some(opt => opt.value === currentValue);
    if (hasCurrent) {
      monthFilter.value = currentValue;
    } else {
      monthFilter.value = options[0].value;
      AppState.filters.month = options[0].value;
    }
  } else {
    monthFilter.value = "";
    AppState.filters.month = "";
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