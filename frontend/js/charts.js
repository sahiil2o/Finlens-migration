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

  const centerTotalEl = document.getElementById("donut-center-total");
  if (centerTotalEl) {
    centerTotalEl.textContent = "₹" + Math.round(totalSpend).toLocaleString("en-IN");
  }

  // ===============================
  // LEGEND
  // ===============================

  legend.innerHTML =
    labels.map((label, idx) => {
      const category = CATEGORIES[label] || CATEGORIES.other;
      const amt = values[idx] || 0;
      const pct = totalSpend ? Math.round((amt / totalSpend) * 100) : 0;
      const formattedAmt = amt.toLocaleString("en-IN", { maximumFractionDigits: 0 });

      return `
        <div class="legend-item" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.02); border: 1px solid var(--border2); padding: 4px 10px; border-radius: 20px; font-size: 0.68rem; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)';" onmouseout="this.style.background='rgba(255,255,255,0.02)';">
          <span class="legend-swatch" style="background:${category.color}; width: 6px; height: 6px; border-radius: 50%;"></span>
          <span style="color: var(--text);">${category.label}</span>
          <span style="color: var(--muted); font-size: 0.6rem; font-family: var(--font-mono); font-weight: 500;">₹${formattedAmt} (${pct}%)</span>
        </div>
      `;
    }).join("");
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
  // CREATE CHART WITH GRADIENT
  // ===============================

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 270);
  gradient.addColorStop(0, "rgba(255, 90, 90, 0.8)"); // Coral glow at top
  gradient.addColorStop(1, "rgba(255, 90, 90, 0.05)"); // Soft fade at bottom

  timelineChart = new Chart(
    canvas,
    {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: gradient,
            hoverBackgroundColor: "rgba(255, 90, 90, 1)",
            borderColor: "#ff5a5a",
            borderWidth: 1.5,
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "rgba(13, 15, 20, 0.95)",
            titleColor: "#ffffff",
            titleFont: {
              family: "'DM Mono', monospace",
              size: 11,
              weight: "bold"
            },
            bodyColor: "#ff9c9c",
            bodyFont: {
              family: "'DM Mono', monospace",
              size: 12
            },
            borderColor: "rgba(255, 90, 90, 0.2)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return "Spent: ₹" + Number(context.raw).toLocaleString("en-IN");
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: "#7b8196",
              font: {
                family: "'DM Mono', monospace",
                size: 9
              }
            },
            grid: {
              display: false
            }
          },
          y: {
            ticks: {
              color: "#7b8196",
              font: {
                family: "'DM Mono', monospace",
                size: 9
              },
              callback: function(value) {
                return "₹" + value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
              }
            },
            grid: {
              color: "rgba(255, 255, 255, 0.05)"
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