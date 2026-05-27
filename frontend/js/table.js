import { AppState } from "./state.js";
import { CATEGORIES } from "./categorizer.js";

// ===============================
// DOM ELEMENTS
// ===============================

let tbody;
let txnCount;
let noResults;

// ===============================
// MAIN TABLE RENDER
// ===============================

export function renderTable() {
  if (!tbody) tbody = document.getElementById("tbody");
  if (!txnCount) txnCount = document.getElementById("txn-count");
  if (!noResults) noResults = document.getElementById("no-results");

  const transactions =
    AppState.filteredTransactions;

  txnCount.textContent =
    `${transactions.length} transactions`;

  if (!transactions.length) {

    tbody.innerHTML = "";

    noResults.style.display = "block";

    return;
  }

  noResults.style.display = "none";

  tbody.innerHTML = transactions
    .map(renderTransactionRow)
    .join("");
}

// ===============================
// SINGLE ROW RENDER
// ===============================

function renderTransactionRow(
  transaction
) {

  // ===========================
  // SAFE FALLBACKS
  // ===========================

  const description =
    transaction.description
    || "Unknown transaction";

  const categoryKey =
    transaction.category
    || "other";

  const category =
    CATEGORIES[categoryKey]
    || CATEGORIES.other;

  const amount =
    Number(transaction.amount)
    || 0;

  // ===========================
  // AMOUNT RENDER
  // ===========================

  const amountHTML =

    transaction.type === "credit"

      ? renderCreditAmount(amount)

      : renderDebitAmount(amount);

  // ===========================
  // TYPE BADGE
  // ===========================

  const typeBadge =

    transaction.type === "credit"

      ? renderCreditBadge()

      : renderDebitBadge();

  // ===========================
  // DESCRIPTION
  // ===========================

  const shortDescription =

    description.length > 38

      ? description.slice(0, 38) + "…"

      : description;

  // ===========================
  // DATE
  // ===========================

  const dateOnly =

    transaction.dateString

      ? transaction.dateString
          .split(" ")[0]

      : "—";

  // ===========================
  // CATEGORY BADGE
  // ===========================

  const categoryBadge =
    renderCategoryBadge(
      transaction,
      category
    );

  return `
    <tr>

      <td class="desc-cell">

        <span
          class="desc-main"
          title="${description}"
        >
          ${shortDescription}
        </span>

        <span class="desc-date">
          ${dateOnly}
        </span>

      </td>

      <td>
        ${categoryBadge}
      </td>

      <td style="text-align:right">
        ${amountHTML}
      </td>

      <td style="text-align:center">
        ${typeBadge}
      </td>

    </tr>
  `;
}

// ===============================
// CATEGORY BADGE
// ===============================

function renderCategoryBadge(
  transaction,
  category
) {

  const isEnriching =

    transaction.category === "other"

    &&

    Number(
      transaction.ai_categorized
    ) === 0;

  if (isEnriching) {

    return `
      <select
        class="category-select"
        style="color:#f59e0b;"
        onchange="manuallyCategorize('${transaction.normalized_merchant || transaction.normalizedMerchant}', this.value, this)"
      >
        <option value="" disabled selected>AI enriching...</option>
        <option value="food">Food & Dining</option>
        <option value="grocery">Grocery</option>
        <option value="shopping">Shopping</option>
        <option value="rent">Rent Payment</option>
        <option value="bills">Bills & Recharge</option>
        <option value="fuel">Fuel</option>
        <option value="entertainment">Entertainment</option>
        <option value="salary">Salary Income</option>
        <option value="family">Family Support</option>
        <option value="reimbursement">Split / Reimbursement</option>
        <option value="payment">Payment / Credit</option>
        <option value="travel">Travel & Cabs</option>
        <option value="health">Health & Pharma</option>
        <option value="investment">Investment</option>
        <option value="other">Other</option>
      </select>
    `;
  }

  return `
    <select
      class="category-select"
      style="color:${category.color};"
      onchange="manuallyCategorize('${transaction.normalized_merchant || transaction.normalizedMerchant}', this.value, this)"
    >
      <option value="food" ${transaction.category === "food" ? "selected" : ""}>Food & Dining</option>
      <option value="grocery" ${transaction.category === "grocery" ? "selected" : ""}>Grocery</option>
      <option value="shopping" ${transaction.category === "shopping" ? "selected" : ""}>Shopping</option>
      <option value="rent" ${transaction.category === "rent" ? "selected" : ""}>Rent Payment</option>
      <option value="bills" ${transaction.category === "bills" ? "selected" : ""}>Bills & Recharge</option>
      <option value="fuel" ${transaction.category === "fuel" ? "selected" : ""}>Fuel</option>
      <option value="entertainment" ${transaction.category === "entertainment" ? "selected" : ""}>Entertainment</option>
      <option value="salary" ${transaction.category === "salary" ? "selected" : ""}>Salary Income</option>
      <option value="family" ${transaction.category === "family" ? "selected" : ""}>Family Support</option>
      <option value="reimbursement" ${transaction.category === "reimbursement" ? "selected" : ""}>Split / Reimbursement</option>
      <option value="payment" ${transaction.category === "payment" ? "selected" : ""}>Payment / Credit</option>
      <option value="travel" ${transaction.category === "travel" ? "selected" : ""}>Travel & Cabs</option>
      <option value="health" ${transaction.category === "health" ? "selected" : ""}>Health & Pharma</option>
      <option value="investment" ${transaction.category === "investment" ? "selected" : ""}>Investment</option>
      <option value="other" ${transaction.category === "other" || !transaction.category ? "selected" : ""}>Other</option>
    </select>
  `;
}

// ===============================
// AMOUNT RENDERERS
// ===============================

function renderDebitAmount(
  amount
) {

  return `
    <span class="amt-debit">
      −₹${amount.toLocaleString(
        "en-IN",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      )}
    </span>
  `;
}

function renderCreditAmount(
  amount
) {

  return `
    <span class="amt-credit">
      +₹${amount.toLocaleString(
        "en-IN",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      )}
    </span>
  `;
}

// ===============================
// TYPE BADGES
// ===============================

function renderDebitBadge() {

  return `
    <span
      style="
        color:var(--red);
        font-size:0.65rem
      "
    >
      DR
    </span>
  `;
}

function renderCreditBadge() {

  return `
    <span
      style="
        color:var(--green);
        font-size:0.65rem
      "
    >
      CR
    </span>
  `;
}

// =================================
// GLOBAL MANUAL OVERRIDE LOGIC
// =================================

window.manuallyCategorize = async function(normalizedName, category, selectElement) {
  const categoryColors = {
    food: "#ff6b4a",
    grocery: "#f5a623",
    shopping: "#5e6bff",
    rent: "#c084fc",
    bills: "#a78bfa",
    fuel: "#3de89b",
    entertainment: "#f472b6",
    salary: "#0ea5e9",
    family: "#f43f5e",
    reimbursement: "#e8f54e",
    payment: "#94a3b8",
    travel: "#38bdf8",
    health: "#ec4899",
    investment: "#10b981",
    other: "#475569"
  };

  // Immediate snappy UI update
  if (selectElement && categoryColors[category]) {
    selectElement.style.color = categoryColors[category];
  }

  try {
    const response = await fetch("http://localhost:3000/vendors/categorize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ normalizedName, category })
    });

    if (!response.ok) {
      throw new Error("Override API responded with failure status");
    }

    showToast(`Updated mapping for "${normalizedName}" to ${category}`);

  } catch (error) {
    console.error("Manual overrides failure:", error);
    showToast("Override failed", "error");
  }
};

window.showCachePanel = async function() {
  document.getElementById('cache-panel').style.display = 'flex';
  await window.renderCachePanel();
};

window.renderCachePanel = async function() {
  try {
    const response = await fetch("http://localhost:3000/vendors");
    const vendors = await response.json();
    
    const filterText = document.getElementById("cache-search").value.toLowerCase();
    const filtered = vendors.filter(v => 
      v.display_name.toLowerCase().includes(filterText) || 
      v.normalized_name.toLowerCase().includes(filterText)
    );
    
    const listElement = document.getElementById("cache-list");
    const footerElement = document.getElementById("cache-footer");
    
    footerElement.textContent = `Showing ${filtered.length} of ${vendors.length} vendors`;
    
    if (filtered.length === 0) {
      listElement.innerHTML = `<div class="empty-state">No vendor mappings found.</div>`;
      return;
    }
    
    listElement.innerHTML = filtered.map(v => {
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px;">
          <div style="font-size:0.78rem; font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;">${v.display_name}</div>
          <select
            class="category-select"
            style="color:${categoryColors[v.category] || "#475569"}; margin:0;"
            onchange="manuallyCategorize('${v.normalized_name}', this.value, this)"
          >
            <option value="food" ${v.category === "food" ? "selected" : ""}>Food</option>
            <option value="grocery" ${v.category === "grocery" ? "selected" : ""}>Grocery</option>
            <option value="shopping" ${v.category === "shopping" ? "selected" : ""}>Shopping</option>
            <option value="rent" ${v.category === "rent" ? "selected" : ""}>Rent</option>
            <option value="bills" ${v.category === "bills" ? "selected" : ""}>Bills</option>
            <option value="fuel" ${v.category === "fuel" ? "selected" : ""}>Fuel</option>
            <option value="entertainment" ${v.category === "entertainment" ? "selected" : ""}>Entertainment</option>
            <option value="salary" ${v.category === "salary" ? "selected" : ""}>Salary</option>
            <option value="family" ${v.category === "family" ? "selected" : ""}>Family</option>
            <option value="reimbursement" ${v.category === "reimbursement" ? "selected" : ""}>Split / Reimbursement</option>
            <option value="payment" ${v.category === "payment" ? "selected" : ""}>Payment</option>
            <option value="travel" ${v.category === "travel" ? "selected" : ""}>Travel</option>
            <option value="health" ${v.category === "health" ? "selected" : ""}>Health</option>
            <option value="investment" ${v.category === "investment" ? "selected" : ""}>Investment</option>
            <option value="other" ${v.category === "other" || !v.category ? "selected" : ""}>Other</option>
          </select>
        </div>
      `;
    }).join("");
    
  } catch (error) {
    console.error("Cache panel load failed:", error);
  }
};

window.clearCache = async function() {
  if (!confirm("Are you sure you want to clear all vendor mappings and database categorization? This will reset all transaction categorization.")) return;
  try {
    const response = await fetch("http://localhost:3000/vendors/clear-cache", { method: "POST" });
    if (!response.ok) throw new Error("Failed to reset database cache");
    
    showToast("Vendor database cache reset successfully.");
    document.getElementById('cache-panel').style.display = 'none';
  } catch (error) {
    console.error("Clear cache failed:", error);
    showToast("Failed to clear cache databases.", "error");
  }
};

const categoryColors = {
  food: "#ff6b4a",
  grocery: "#f5a623",
  shopping: "#5e6bff",
  rent: "#c084fc",
  bills: "#a78bfa",
  fuel: "#3de89b",
  entertainment: "#f472b6",
  salary: "#0ea5e9",
  family: "#f43f5e",
  reimbursement: "#e8f54e",
  payment: "#94a3b8",
  travel: "#38bdf8",
  health: "#ec4899",
  investment: "#10b981",
  other: "#475569"
};

async function showToast(msg, type = "success") {
  const ui = await import("./ui.js");
  ui.showToast(msg, type);
}