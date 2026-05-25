import { AppState } from "./state.js";

// ===============================
// DOM ELEMENTS
// ===============================

const summaryStrip =
  document.getElementById(
    "summary-strip"
  );

const utilSection =
  document.getElementById(
    "util-section"
  );

// ===============================
// MAIN SUMMARY RENDER
// ===============================

export function renderSummary() {

  // ===========================
  // USE FILTERED TRANSACTIONS
  // ===========================

  const transactions =
    AppState.filteredTransactions;

  const meta =
    AppState.meta || {};

  // ===========================
  // SPENDING TRANSACTIONS
  // ===========================

  const spendTransactions =
    transactions.filter(
      transaction => {

        // Only debit transactions
        if (
          transaction.type !== "debit"
        ) {
          return false;
        }

        const description =
          transaction.description
            ?.toLowerCase() || "";

        // Ignore card repayments
        if (

          description.includes(
            "credit card"
          )

          ||

          description.includes(
            "card payment"
          )

          ||

          description.includes(
            "cc payment"
          )

          ||

          description.includes(
            "autopay"
          )

        ) {

          return false;
        }

        return true;
      }
    );

  // ===========================
  // CALCULATIONS
  // ===========================

  const totalSpend =

    spendTransactions.reduce(
      (sum, transaction) =>

        sum +
        Number(
          transaction.amount
        ),

      0
    );

  const totalCredits =

    transactions

      .filter(
        transaction =>

          transaction.type
          === "credit"
      )

      .reduce(
        (sum, transaction) =>

          sum +
          Number(
            transaction.amount
          ),

        0
      );

  const txnCount =
    transactions.length;

  const totalDue =
    Number(
      meta.totalDue
    ) || 0;

  const creditLimit =
    Number(
      meta.creditLimit
    ) || 0;

  const utilization =

    creditLimit

      ? (
          (
            totalDue
            /
            creditLimit
          ) * 100
        ).toFixed(1)

      : "0.0";

  // ===========================
  // SUMMARY STRIP
  // ===========================

  summaryStrip.innerHTML = `

    ${buildCard(
      "Total Spend",

      formatCurrency(
        totalSpend
      ),

      "Filtered spend",

      "#ff5a5a"
    )}

    ${buildCard(
      "Payments",

      formatCurrency(
        totalCredits
      ),

      "Credits received",

      "#3de89b"
    )}

    ${buildCard(
      "Transactions",

      txnCount,

      "Visible transactions",

      "#5e6bff"
    )}

    ${buildCard(
      "Total Due",

      formatCurrency(
        totalDue
      ),

      "Current statement",

      "#e8f54e"
    )}

  `;

  // ===========================
  // UTILIZATION SECTION
  // ===========================

  utilSection.innerHTML = `

    <div class="util-label-group">

      <p class="util-title">
        Credit utilization
      </p>

      <p class="util-pct">
        ${utilization}%
      </p>

    </div>

    <div class="util-bar-wrap">

      <div class="util-track">

        <div
          class="util-fill"
          style="
            width:${Math.min(
              utilization,
              100
            )}%
          "
        ></div>

      </div>

      <div class="util-meta">

        <span>
          Used:
          ${formatCurrency(
            totalDue
          )}
        </span>

        <span>
          Limit:
          ${formatCurrency(
            creditLimit
          )}
        </span>

      </div>

    </div>

    <div
      class="
        util-status
        ${utilization > 30
          ? "warn"
          : "good"}
      "
    >

      ${utilization > 30
        ? "High usage"
        : "Healthy"}

    </div>
  `;
}

// ===============================
// SUMMARY CARD
// ===============================

function buildCard(
  label,
  value,
  sub,
  color
) {

  return `
    <div
      class="stat-card fade-in"
      style="
        --card-accent:${color}
      "
    >

      <p class="stat-label">
        ${label}
      </p>

      <p class="stat-value">
        ${value}
      </p>

      <p class="stat-sub">
        ${sub}
      </p>

    </div>
  `;
}

// ===============================
// FORMATTERS
// ===============================

function formatCurrency(
  amount
) {

  return `₹${Number(amount)
    .toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    )}`;
}