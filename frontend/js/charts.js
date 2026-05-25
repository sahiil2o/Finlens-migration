import { AppState } from "./state.js";
import { CATEGORIES } from "./categorizer.js";

// ===============================
// CHART INSTANCES
// ===============================

let categoryChart = null;

let timelineChart = null;

// ===============================
// MAIN CHART RENDER
// ===============================

export function renderCharts() {

  renderCategoryChart();

  renderTimelineChart();
}

// ===============================
// FILTER VALID SPENDING
// ===============================

function getSpendTransactions() {

  return AppState.filteredTransactions.filter(
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

      // Ignore credit card bill payments
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
}

// ===============================
// CATEGORY DONUT CHART
// ===============================

function renderCategoryChart() {

  const canvas =
    document.getElementById(
      "catChart"
    );

  const legend =
    document.getElementById(
      "cat-legend"
    );

  if (!canvas) return;

  // ===============================
  // FILTERED SPENDING DATA
  // ===============================

  const transactions =
    getSpendTransactions();

  const categoryTotals = {};

  for (
    const transaction
    of transactions
  ) {

    const category =
      transaction.category
      || "other";

    categoryTotals[category] =

      (categoryTotals[category] || 0)

      + transaction.amount;
  }

  const labels =
    Object.keys(categoryTotals);

  const values =
    Object.values(categoryTotals);

  const colors =
    labels.map(label =>

      CATEGORIES[label]?.color

      || "#475569"
    );

  // ===============================
  // DESTROY PREVIOUS CHART
  // ===============================

  if (categoryChart) {
    categoryChart.destroy();
  }

  // ===============================
  // CREATE CHART
  // ===============================

  categoryChart = new Chart(
    canvas,
    {
      type: "doughnut",

      data: {

        labels,

        datasets: [
          {
            data: values,

            backgroundColor:
              colors,

            borderWidth: 0
          }
        ]
      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: "68%",

        plugins: {

          legend: {
            display: false
          }
        }
      }
    }
  );

  // ===============================
  // LEGEND
  // ===============================

  legend.innerHTML =

    labels.map(label => {

      const category =

        CATEGORIES[label]

        || CATEGORIES.other;

      return `
        <div class="legend-item">

          <span
            class="legend-swatch"
            style="
              background:${category.color}
            "
          ></span>

          <span>
            ${category.label}
          </span>

        </div>
      `;
    }).join("");

  // ===============================
  // TOTAL SPEND
  // ===============================

  const totalSpend =

    values.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  const totalElement =
    document.getElementById(
      "cat-total"
    );

  if (totalElement) {

    totalElement.textContent =
      formatCurrency(totalSpend);
  }
}

// ===============================
// TIMELINE CHART
// ===============================

function renderTimelineChart() {

  const canvas =
    document.getElementById(
      "timeChart"
    );

  if (!canvas) return;

  // ===============================
  // FILTERED SPENDING DATA
  // ===============================

  const transactions =
    getSpendTransactions();

  const dailyTotals = {};

  for (
    const transaction
    of transactions
  ) {

    let formattedDate =
      "Unknown";

    // ===========================
    // SQLITE DATE FORMAT
    // ===========================

    if (transaction.date) {

      const parsedDate =

        new Date(
          transaction.date
        );

      if (
        !isNaN(parsedDate)
      ) {

        formattedDate =

          parsedDate
            .toLocaleDateString(
              "en-GB"
            );
      }
    }

    // ===========================
    // FALLBACK FORMAT
    // ===========================

    else if (
      transaction.dateString
    ) {

      formattedDate =

        transaction.dateString
          .split(" ")[0];
    }

    dailyTotals[formattedDate] =

      (dailyTotals[formattedDate] || 0)

      + transaction.amount;
  }

  const labels =

    Object.keys(dailyTotals)

      .sort((a, b) => {

        if (
          a === "Unknown"
          ||
          b === "Unknown"
        ) {
          return 0;
        }

        const [
          d1,
          m1,
          y1
        ] = a.split("/");

        const [
          d2,
          m2,
          y2
        ] = b.split("/");

        return new Date(
          `${y1}-${m1}-${d1}`
        )

        -

        new Date(
          `${y2}-${m2}-${d2}`
        );
      });

  const values =

    labels.map(
      label =>
        dailyTotals[label]
    );

  // ===============================
  // DESTROY PREVIOUS CHART
  // ===============================

  if (timelineChart) {
    timelineChart.destroy();
  }

  // ===============================
  // CREATE CHART
  // ===============================

  timelineChart = new Chart(
    canvas,
    {
      type: "bar",

      data: {

        labels,

        datasets: [
          {
            data: values,

            borderRadius: 6
          }
        ]
      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        plugins: {

          legend: {
            display: false
          }
        },

        scales: {

          x: {

            ticks: {
              color: "#7b8196"
            },

            grid: {
              display: false
            }
          },

          y: {

            ticks: {
              color: "#7b8196"
            },

            grid: {
              color:
                "rgba(255,255,255,0.05)"
            }
          }
        }
      }
    }
  );
}

// ===============================
// FORMATTER
// ===============================

function formatCurrency(amount) {

  return `₹${amount.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  )}`;
}