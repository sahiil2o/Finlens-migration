import { AppState } from "./state.js";
import { CATEGORIES } from "./categorizer.js";
import { categoryColors } from "./components/CachePanel.js";

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

async function showToast(msg, type = "success") {
  const ui = await import("./ui.js");
  ui.showToast(msg, type);
}