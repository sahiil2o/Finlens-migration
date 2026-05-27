import express from "express";

import { getTransactions } from "../database.js";
import {
  detectRecurringSubscriptions,
  getMonthKey,
  isSpendTransaction
} from "../helpers.js";

const router = express.Router();

// ===============================
// GET SUBSCRIPTIONS
// ===============================
router.get("/subscriptions", async (req, res) => {
  try {
    const { accountId } = req.query;
    let rows = await getTransactions();

    if (accountId && accountId !== "all") {
      rows = rows.filter(row => row.source_bank === accountId);
    }

    const subscriptions = detectRecurringSubscriptions(rows);
    res.json(subscriptions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to detect subscriptions" });
  }
});

// ===============================
// GET HISTORICAL TRENDS & FORECAST
// ===============================
router.get("/analytics/trends", async (req, res) => {
  try {
    const { accountId } = req.query;
    let rows = await getTransactions();

    if (accountId && accountId !== "all") {
      rows = rows.filter(row => row.source_bank === accountId);
    }

    const monthsData = {};

    for (const row of rows) {
      const monthKey = getMonthKey(row.date);
      if (monthKey === "Unknown") continue;

      if (!monthsData[monthKey]) {
        monthsData[monthKey] = {
          month: monthKey,
          totalSpend: 0,
          totalCredits: 0,
          byCategory: {}
        };
      }

      const isSpend = isSpendTransaction(row);

      if (isSpend) {
        monthsData[monthKey].totalSpend += Number(row.amount);
        
        const cat = row.category || "other";
        monthsData[monthKey].byCategory[cat] =
          (monthsData[monthKey].byCategory[cat] || 0) + Number(row.amount);
      } else if (row.type === "credit") {
        monthsData[monthKey].totalCredits += Number(row.amount);
      }
    }

    const monthKeys = Object.keys(monthsData).sort();
    const chronologicalMonths = monthKeys.filter(m => m !== "Unknown");
    
    const trends = chronologicalMonths.map(key => monthsData[key]);

    // Calculate Forecast
    let forecastValue = 0;
    const count = chronologicalMonths.length;
    if (count >= 3) {
      const m1 = monthsData[chronologicalMonths[count - 1]].totalSpend;
      const m2 = monthsData[chronologicalMonths[count - 2]].totalSpend;
      const m3 = monthsData[chronologicalMonths[count - 3]].totalSpend;
      forecastValue = 0.5 * m1 + 0.3 * m2 + 0.2 * m3;
    } else if (count === 2) {
      const m1 = monthsData[chronologicalMonths[1]].totalSpend;
      const m2 = monthsData[chronologicalMonths[0]].totalSpend;
      forecastValue = 0.6 * m1 + 0.4 * m2;
    } else if (count === 1) {
      forecastValue = monthsData[chronologicalMonths[0]].totalSpend;
    }

    // Generate Insights
    const insights = [];
    const formatCurrencyLocal = (amt) => {
      return `₹${Number(amt).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })}`;
    };

    if (count >= 2) {
      const currentMonthKey = chronologicalMonths[count - 1];
      const prevMonthKey = chronologicalMonths[count - 2];
      
      const currentData = monthsData[currentMonthKey];
      const prevData = monthsData[prevMonthKey];
      
      const spendDiff = currentData.totalSpend - prevData.totalSpend;
      const spendPct = prevData.totalSpend ? Math.round((spendDiff / prevData.totalSpend) * 100) : 0;
      
      if (spendPct > 10) {
        insights.push({
          type: "warning",
          text: `Your overall monthly spending increased by ${spendPct}% compared to last month.`
        });
      } else if (spendPct < -10) {
        insights.push({
          type: "success",
          text: `Great job! Your spending decreased by ${Math.abs(spendPct)}% compared to last month.`
        });
      } else {
        insights.push({
          type: "info",
          text: `Your spending remained stable this month (changed by only ${spendPct}%).`
        });
      }

      const currentNet = currentData.totalCredits - currentData.totalSpend;
      if (currentNet > 0) {
        insights.push({
          type: "success",
          text: `Positive cashflow! You saved ${formatCurrencyLocal(currentNet)} this cycle.`
        });
      } else if (currentNet < 0) {
        insights.push({
          type: "warning",
          text: `Outflow exceeded inflow by ${formatCurrencyLocal(Math.abs(currentNet))} this cycle.`
        });
      }

      const categories = Object.keys(currentData.byCategory);
      for (const cat of categories) {
        if (cat === "payment" || cat === "other") continue;
        const currentCatSpend = currentData.byCategory[cat] || 0;
        const prevCatSpend = prevData.byCategory[cat] || 0;
        
        if (prevCatSpend > 500) {
          const catDiff = currentCatSpend - prevCatSpend;
          const catPct = Math.round((catDiff / prevCatSpend) * 100);
          if (catPct > 20) {
            insights.push({
              type: "warning",
              text: `Spend in "${cat}" accelerated by ${catPct}% compared to last month!`
            });
          }
        }
      }
    } else {
      insights.push({
        type: "info",
        text: "Upload statements across multiple billing cycles to unlock cashflow trends and forecasting insights!"
      });
    }

    res.json({
      trends,
      forecast: {
        value: Math.round(forecastValue),
        insights
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to compile trend analytics"
    });
  }
});

export default router;
