import { AppState } from "./state.js";
import { API_BASE } from "./config.js";
import { calculateSalaryCycles } from "./calculator.js";
import { getAccountMeta } from "./metaStore.js";

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
    const selectedMonth = AppState.filters?.month || "";
    const isSavings = accountId.includes("Savings");
    const isCC = accountId.includes("CC") || accountId === "HDFC Credit Card";

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

    let periods = [];

    if (isSavings) {
      const savedMeta = getAccountMeta(accountId) || AppState.meta || {};
      const descendingCycles = calculateSalaryCycles(AppState.transactions || [], accountId, savedMeta);
      const ascendingCycles = [...descendingCycles].reverse();
      
      periods = ascendingCycles.map(cycle => ({
        label: cycle.salaryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + 
               " - " + 
               cycle.endDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        totalSpend: cycle.spend,
        totalCredits: cycle.totalCredited,
        netSaved: cycle.cycleSavings,
        key: `cycle:${cycle.salaryDate.toISOString().split("T")[0]}_${cycle.endDate.toISOString().split("T")[0]}`
      }));
    } else if (isCC) {
      const ccTxns = (AppState.transactions || []).filter(t => 
        accountId === "HDFC Credit Card"
          ? (t.sourceBank && t.sourceBank.includes("CC"))
          : t.sourceBank === accountId
      );
      const stmtDates = [...new Set(ccTxns.map(t => t.statementDate))].filter(Boolean);
      stmtDates.sort((a, b) => parseDateStr(a) - parseDateStr(b));

      const rawPeriods = stmtDates.map(stmt => {
        const endDate = parseDateStr(stmt);
        const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 13);
        const displayEndDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        
        const periodTxns = ccTxns.filter(t => t.statementDate === stmt);
        
        // Exclude payment loops/transfers to match calculator.js spends exactly
        const spendTxns = periodTxns.filter(t => {
          if (t.type !== "debit") return false;
          const description = t.description?.toLowerCase() || "";
          if (
            description.includes("credit card") ||
            description.includes("card payment") ||
            description.includes("cc payment") ||
            description.includes("autopay")
          ) {
            return false;
          }
          return true;
        });

        const totalSpend = spendTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalCredits = periodTxns.filter(t => t.type === "credit").reduce((sum, t) => sum + Number(t.amount || 0), 0);
        
        return {
          label: `${formatDateLabel(startDate).slice(0, 6)} - ${formatDateLabel(displayEndDate).slice(0, 6)}`,
          totalSpend,
          totalCredits,
          key: `stmt:${stmt}`
        };
      });

      // Shift the payments (credits) so that the payment for statement i is taken from the credits of statement i+1
      periods = rawPeriods.map((p, idx) => {
        const alignedCredits = (idx + 1 < rawPeriods.length) ? rawPeriods[idx + 1].totalCredits : 0;
        return {
          label: p.label,
          totalSpend: p.totalSpend,
          totalCredits: alignedCredits,
          netSaved: alignedCredits - p.totalSpend,
          key: p.key
        };
      });
    } else {
      // Overview (all accounts)
      const transactions = AppState.transactions || [];
      const monthsData = {};

      const isSpend = (t) => {
        if (t.type !== "debit") return false;
        const desc = t.description?.toLowerCase() || "";
        if (t.sourceBank && t.sourceBank.includes("Savings")) return true;
        const excludedPatterns = ["credit card", "card payment", "cc payment", "autopay", "refund", "reversal", "cashback"];
        return !excludedPatterns.some(pat => desc.includes(pat));
      };

      for (const row of transactions) {
        if (!row.date) continue;
        const d = new Date(row.date);
        if (isNaN(d.getTime())) continue;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (!monthsData[monthKey]) {
          monthsData[monthKey] = {
            totalSpend: 0,
            totalCredits: 0
          };
        }

        if (isSpend(row)) {
          monthsData[monthKey].totalSpend += Number(row.amount || 0);
        } else if (row.type === "credit") {
          monthsData[monthKey].totalCredits += Number(row.amount || 0);
        }
      }

      const sortedMonthKeys = Object.keys(monthsData).sort();
      periods = sortedMonthKeys.map(key => {
        const [year, month] = key.split("-");
        const dateObj = new Date(year, parseInt(month) - 1, 1);
        const label = dateObj.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
        
        return {
          label,
          totalSpend: monthsData[key].totalSpend,
          totalCredits: monthsData[key].totalCredits,
          netSaved: monthsData[key].totalCredits - monthsData[key].totalSpend,
          key: `month:${key}`
        };
      });
    }

    if (periods.length === 0) {
      renderForecast(null);
      return;
    }

    // Build trends for the chart
    const trends = periods.map(p => ({
      month: p.label,
      totalSpend: p.totalSpend,
      totalCredits: p.totalCredits
    }));

    renderTrendChart(trends, isCC, isSavings);

    // Determine current index to show insights for
    let currentIdx = periods.length - 1; // default to latest
    if (selectedMonth && selectedMonth !== "all") {
      const idx = periods.findIndex(p => p.key === selectedMonth);
      if (idx !== -1) {
        currentIdx = idx;
      }
    }

    const currentPeriod = periods[currentIdx];

    // Calculate forecast value (weighted moving average of last 3 cycles leading up to the current selected one)
    let forecastValue = 0;
    if (currentIdx >= 2) {
      const m1 = periods[currentIdx].totalSpend;
      const m2 = periods[currentIdx - 1].totalSpend;
      const m3 = periods[currentIdx - 2].totalSpend;
      forecastValue = 0.5 * m1 + 0.3 * m2 + 0.2 * m3;
    } else if (currentIdx === 1) {
      const m1 = periods[1].totalSpend;
      const m2 = periods[0].totalSpend;
      forecastValue = 0.6 * m1 + 0.4 * m2;
    } else {
      forecastValue = periods[0].totalSpend;
    }

    // Generate Insights comparing the selected cycle to the previous one
    const insights = [];
    const formatCurrencyLocal = (amt) => {
      return `₹${Number(amt).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })}`;
    };

    if (currentIdx >= 1) {
      const prevPeriod = periods[currentIdx - 1];
      const spendDiff = currentPeriod.totalSpend - prevPeriod.totalSpend;
      const spendPct = prevPeriod.totalSpend ? Math.round((spendDiff / prevPeriod.totalSpend) * 100) : 0;

      const periodName = (isCC || isSavings) ? "cycle" : "month";
      const comparisonName = (isCC || isSavings) ? "last cycle" : "last month";

      if (spendPct > 10) {
        insights.push({
          type: "warning",
          text: `Your overall ${periodName} spending increased by ${spendPct}% compared to ${comparisonName}.`
        });
      } else if (spendPct < -10) {
        insights.push({
          type: "success",
          text: `Great job! Your spending decreased by ${Math.abs(spendPct)}% compared to ${comparisonName}.`
        });
      } else {
        insights.push({
          type: "info",
          text: `Your spending remained stable this ${periodName} (changed by only ${spendPct}%).`
        });
      }

      const currentNet = currentPeriod.netSaved;
      if (currentNet > 0) {
        if (isCC) {
          insights.push({
            type: "success",
            text: `Credit paid down! You paid ${formatCurrencyLocal(currentNet)} more than you charged this cycle.`
          });
        } else if (isSavings) {
          insights.push({
            type: "success",
            text: `Positive cashflow! You saved ${formatCurrencyLocal(currentNet)} this cycle.`
          });
        } else {
          insights.push({
            type: "success",
            text: `Positive cashflow! You saved ${formatCurrencyLocal(currentNet)} this month.`
          });
        }
      } else if (currentNet < 0) {
        if (isCC) {
          insights.push({
            type: "warning",
            text: `Card balance increased! You charged ${formatCurrencyLocal(Math.abs(currentNet))} more than you paid this cycle.`
          });
        } else if (isSavings) {
          insights.push({
            type: "warning",
            text: `Outflow exceeded inflow by ${formatCurrencyLocal(Math.abs(currentNet))} this cycle.`
          });
        } else {
          insights.push({
            type: "warning",
            text: `Outflow exceeded inflow by ${formatCurrencyLocal(Math.abs(currentNet))} this month.`
          });
        }
      }
    } else {
      insights.push({
        type: "info",
        text: "Upload statements across multiple cycles to unlock cashflow trends and forecasting insights!"
      });
    }

    renderForecast({
      value: Math.round(forecastValue),
      insights
    });

  } catch (error) {
    console.error("Trends compile failure:", error);
  }
}

// ===============================
// RENDER MULTI-DATASET CHART.JS
// ===============================

function renderTrendChart(trends, isCC, isSavings) {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;

  if (!Array.isArray(trends) || !trends.length) {
    return;
  }

  // Format month labels
  const labels = trends.map(item => {
    // If the month is already a formatted cycle label (contains " - " or does not match YYYY-MM)
    if (item.month.includes(" - ") || !/^\d{4}-\d{2}$/.test(item.month)) {
      return item.month;
    }
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

  const spendLabel = isCC ? "Card Spend" : (isSavings ? "Cycle Outflows" : "Spend (Debits)");
  const creditLabel = isCC ? "Payments Made" : (isSavings ? "Total Credited" : "Inflow (Credits)");

  trendChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: spendLabel,
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
          label: creditLabel,
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
