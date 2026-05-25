import { AppState } from "./state.js";
import { CATEGORIES } from "./categorizer.js";

// ===============================
// DOM ELEMENTS
// ===============================

const tbody =
  document.getElementById("tbody");

const txnCount =
  document.getElementById("txn-count");

const noResults =
  document.getElementById("no-results");

// ===============================
// MAIN TABLE RENDER
// ===============================

export function renderTable() {

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

  // ===========================
  // AI ENRICHMENT STATE
  // ===========================

  const isEnriching =

    transaction.category === "other"

    &&

    Number(
      transaction.ai_categorized
    ) === 0;

  // ===========================
  // AI ENRICHING BADGE
  // ===========================

  if (isEnriching) {

    return `
      <span
        class="badge"
        style="
          color:#f59e0b;
          border-color:#f59e0b;
          background:rgba(245,158,11,0.08);
        "
      >
        AI enriching...
      </span>
    `;
  }

  // ===========================
  // NORMAL CATEGORY BADGE
  // ===========================

  return `
    <span
      class="badge"
      style="
        color:${category.color};
        border-color:${category.color};
        background:rgba(255,255,255,0.04);
      "
    >
      ${category.label}
    </span>
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