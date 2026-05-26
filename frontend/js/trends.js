import { AppState } from "./state.js";

// ===============================
// DYNAMIC TREND CHART INSTANCE
// ===============================

let trendChart = null;

// ===============================
// RENDER TRENDS & FORECAST
// ===============================

export async function renderTrends() {
  try {
    const accountId = AppState.filters?.accountId || "";
    const response = await fetch(`http://localhost:3000/analytics/trends?accountId=${encodeURIComponent(accountId)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch historical trends");
    }

    const data = await response.json();
    const { trends, forecast } = data;

    renderTrendChart(trends);
    renderForecast(forecast);

  } catch (error) {
    console.error("Trends compile failure:", error);
  }
}

// ===============================
// RENDER MULTI-DATASET CHART.JS
// ===============================

function renderTrendChart(trends) {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;

  if (!Array.isArray(trends) || !trends.length) {
    return;
  }

  // Format month labels (e.g., 2026-05 -> May 26)
  const labels = trends.map(item => {
    const [year, month] = item.month.split("-");
    const dateObj = new Date(year, parseInt(month) - 1, 1);
    return dateObj.toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit"
    });
  });

  const spendValues = trends.map(item => item.totalSpend);
  const creditValues = trends.map(item => item.totalCredits);

  if (trendChart) {
    trendChart.destroy();
  }

  trendChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Spend (Debits)",
          data: spendValues,
          borderColor: "#ff5a5a",
          backgroundColor: "rgba(255, 90, 90, 0.05)",
          borderWidth: 2,
          pointBackgroundColor: "#ff5a5a",
          pointRadius: 4,
          tension: 0.35,
          fill: true
        },
        {
          label: "Credits",
          data: creditValues,
          borderColor: "#3de89b",
          backgroundColor: "rgba(61, 232, 155, 0.05)",
          borderWidth: 2,
          pointBackgroundColor: "#3de89b",
          pointRadius: 4,
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: "#7b8196",
            font: {
              family: "'DM Mono', monospace",
              size: 10
            },
            boxWidth: 12
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
            color: "rgba(255,255,255,0.05)"
          }
        }
      }
    }
  });
}

// ===============================
// RENDER FORECAST VALUES & PILLS
// ===============================

function renderForecast(forecast) {
  const valueElement = document.getElementById("forecast-value");
  const insightsElement = document.getElementById("forecast-insights");

  if (!valueElement || !insightsElement) return;

  if (!forecast || !forecast.insights || !forecast.insights.length) {
    valueElement.textContent = "—";
    insightsElement.innerHTML = `
      <div class="empty-state">No forecast data compiled.</div>
    `;
    return;
  }

  // Large Value format
  valueElement.textContent = `₹${Number(forecast.value).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;

  // Process and append glassmorphic indicator pills
  insightsElement.innerHTML = forecast.insights
    .map(insight => {
      const type = insight.type || "info"; // success, warning, info
      let icon = "ℹ️";
      if (type === "warning") icon = "⚠️";
      if (type === "success") icon = "📈";

      return `
        <div class="insight-pill ${type} fade-in">
          <span style="font-size: 1.1rem; flex-shrink:0;">${icon}</span>
          <span>${insight.text}</span>
        </div>
      `;
    })
    .join("");
}
