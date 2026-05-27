import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

import db from "./database.js";

import { categorizeVendor, loadCache, saveCache } from "./ai.js";

import {
  initializeDatabase,
  saveTransactions,
  getTransactions,
  getVendors,
  saveAccountMetadata,
  getAccountMetadata
} from "./database.js";

import {
  enqueue
} from "./aiQueue.js";

const app = express();

initializeDatabase();

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());

app.use(express.json());

// ===============================
// HEALTH CHECK
// ===============================

app.get("/health", (req, res) => {

  res.json({
    ok: true,
    service: "FinLens Local AI"
  });
});

// ===============================
// NORMALIZE TRANSACTIONS
// ===============================

function normalizeTransactions(
  rows
) {

  return rows.map(row => {

    const parsedDate =

      row.date
        ? new Date(row.date)
        : null;

    const dateString =

      parsedDate &&
      !isNaN(parsedDate)

        ? parsedDate
            .toLocaleDateString(
              "en-GB"
            )

        : "—";

    return {

      ...row,

      description:
        row.merchant,

      normalizedMerchant:
        row.normalized_merchant,

      sourceBank:
        row.source_bank,

      statementDate:
        row.statement_date,

      dateString
    };
  });
}

// ===============================
// SPEND FILTER
// ===============================

function isSpendTransaction(
  transaction
) {

  if (
    transaction.type !== "debit"
  ) {

    return false;
  }

  const description =

    transaction.merchant
      ?.toLowerCase() || "";

  const excludedPatterns = [

    "autopay",

    "thank you",

    "credit card",

    "card payment",

    "cc payment",

    "refund",

    "reversal",

    "cashback"
  ];

  return !excludedPatterns.some(
    pattern =>

      description.includes(
        pattern
      )
  );
}

// ===============================
// RECURRING DETECTION
// ===============================

function detectRecurringSubscriptions(
  transactions
) {

  const grouped = {};

  // =============================
  // GROUP BY MERCHANT
  // =============================

  for (
    const transaction
    of transactions
  ) {

    if (
      !isSpendTransaction(
        transaction
      )
    ) {
      continue;
    }

    const merchant =

      transaction.normalized_merchant;

    if (!merchant) continue;

    if (!grouped[merchant]) {

      grouped[merchant] = [];
    }

    grouped[merchant].push(
      transaction
    );
  }

  const subscriptions = [];

  // =============================
  // ANALYZE PATTERNS
  // =============================

  for (
    const [
      merchant,
      vendorTransactions
    ]
    of Object.entries(grouped)
  ) {

    // Need recurrence
    if (
      vendorTransactions.length < 2
    ) {
      continue;
    }

    // Sort by date
    vendorTransactions.sort(
      (a, b) =>

        new Date(a.date)

        -

        new Date(b.date)
    );

    // =========================
    // AVG AMOUNT
    // =========================

    const avgAmount =

      vendorTransactions.reduce(
        (sum, transaction) =>

          sum +
          Number(
            transaction.amount
          ),

        0
      )

      /

      vendorTransactions.length;

    // =========================
    // AMOUNT CONSISTENCY
    // =========================

    const similarAmounts =

      vendorTransactions.every(
        transaction => {

          const diff = Math.abs(

            Number(
              transaction.amount
            )

            -

            avgAmount
          );

          return diff < (
            avgAmount * 0.25
          );
        }
      );

    if (!similarAmounts) {
      continue;
    }

    // =========================
    // DATE GAPS
    // =========================

    const gaps = [];

    for (
      let i = 1;
      i < vendorTransactions.length;
      i++
    ) {

      const prev =
        new Date(
          vendorTransactions[
            i - 1
          ].date
        );

      const curr =
        new Date(
          vendorTransactions[
            i
          ].date
        );

      const days = Math.round(

        (
          curr - prev
        )

        /

        (
          1000 * 60 * 60 * 24
        )
      );

      gaps.push(days);
    }

    // =========================
    // MONTHLY-LIKE PATTERN
    // =========================

    const recurring =

      gaps.every(
        gap =>

          gap >= 20
          &&
          gap <= 40
      );

    if (!recurring) {
      continue;
    }

    // =========================
    // CONFIDENCE SCORE
    // =========================

    let confidence = 60;

    if (
      vendorTransactions.length >= 3
    ) {
      confidence += 15;
    }

    if (
      vendorTransactions.length >= 5
    ) {
      confidence += 15;
    }

    confidence = Math.min(
      confidence,
      95
    );

    // =========================
    // BUILD RESULT
    // =========================

    subscriptions.push({

      merchant,

      displayName:
        vendorTransactions[0]
          .merchant,

      category:
        vendorTransactions[0]
          .category,

      recurringCount:
        vendorTransactions.length,

      averageAmount:
        avgAmount,

      lastCharge:
        vendorTransactions.at(-1)
          .date,

      averageGapDays:

        Math.round(

          gaps.reduce(
            (a, b) => a + b,
            0
          )

          /

          gaps.length
        ),

      confidence
    });
  }

  // =============================
  // SORT BY CONFIDENCE
  // =============================

  subscriptions.sort(
    (a, b) =>

      b.confidence
      -
      a.confidence
  );

  return subscriptions;
}

// ===============================
// GET TRANSACTIONS
// ===============================

app.get(
  "/transactions",
  async (req, res) => {

    try {

      const rows =
        await getTransactions();

      const normalizedRows =
        normalizeTransactions(
          rows
        );

      res.json(
        normalizedRows
      );

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Failed to fetch transactions"
      });
    }
  }
);

// ===============================
// GET & POST ACCOUNT METADATA
// ===============================

app.post(
  "/metadata",
  async (req, res) => {
    try {
      const { metadata } = req.body;
      if (!metadata || !metadata.accountId) {
        return res.status(400).json({ error: "Metadata with accountId required" });
      }
      await saveAccountMetadata(metadata);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save metadata:", error);
      res.status(500).json({ error: "Failed to save metadata" });
    }
  }
);

app.get(
  "/metadata",
  async (req, res) => {
    try {
      const rows = await getAccountMetadata();
      res.json(rows);
    } catch (error) {
      console.error("Failed to fetch metadata:", error);
      res.status(500).json({ error: "Failed to fetch metadata" });
    }
  }
);

// ===============================
// GET ALL VENDORS
// ===============================
app.get(
  "/vendors",
  async (req, res) => {
    try {
      const { accountId } = req.query;
      let query = `
        SELECT 
          normalized_merchant AS normalized_name,
          MAX(merchant) AS display_name,
          MAX(category) AS category,
          COUNT(*) AS transaction_count,
          SUM(amount) AS total_spend,
          MIN(date) AS first_seen,
          MAX(date) AS last_seen
        FROM transactions
        WHERE type = 'debit' AND NOT (
          merchant LIKE '%autopay%' OR 
          merchant LIKE '%thank you%' OR 
          merchant LIKE '%credit card%' OR 
          merchant LIKE '%card payment%' OR 
          merchant LIKE '%cc payment%' OR 
          merchant LIKE '%payment received%' OR 
          merchant LIKE '%cashback%' OR 
          merchant LIKE '%reversal%' OR 
          merchant LIKE '%refund%'
        )
      `;
      
      const params = [];
      if (accountId && accountId !== "all") {
        query += ` AND source_bank = ?`;
        params.push(accountId);
      }
      
      query += ` GROUP BY normalized_merchant ORDER BY total_spend DESC`;

      db.all(query, params, (error, rows) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ error: "Failed to fetch vendors" });
        }
        res.json(rows);
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  }
);

// ===============================
// GET TOP VENDORS
// ===============================
app.get(
  "/vendors/top",
  async (req, res) => {
    try {
      const { accountId } = req.query;
      let query = `
        SELECT 
          normalized_merchant AS normalized_name,
          MAX(merchant) AS display_name,
          MAX(category) AS category,
          COUNT(*) AS transaction_count,
          SUM(amount) AS total_spend,
          MIN(date) AS first_seen,
          MAX(date) AS last_seen
        FROM transactions
        WHERE type = 'debit' AND NOT (
          merchant LIKE '%autopay%' OR 
          merchant LIKE '%thank you%' OR 
          merchant LIKE '%credit card%' OR 
          merchant LIKE '%card payment%' OR 
          merchant LIKE '%cc payment%' OR 
          merchant LIKE '%payment received%' OR 
          merchant LIKE '%cashback%' OR 
          merchant LIKE '%reversal%' OR 
          merchant LIKE '%refund%'
        )
      `;
      
      const params = [];
      if (accountId && accountId !== "all") {
        query += ` AND source_bank = ?`;
        params.push(accountId);
      }
      
      query += `
        GROUP BY normalized_merchant
        ORDER BY total_spend DESC
        LIMIT 10
      `;

      db.all(query, params, (error, rows) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ error: "Failed to fetch top vendors" });
        }
        res.json(rows);
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch top vendors" });
    }
  }
);

// ===============================
// GET SUBSCRIPTIONS
// ===============================

app.get(
  "/subscriptions",
  async (req, res) => {

    try {
      const { accountId } = req.query;
      let rows = await getTransactions();

      if (accountId && accountId !== "all") {
        rows = rows.filter(row => row.source_bank === accountId);
      }

      const subscriptions =

        detectRecurringSubscriptions(
          rows
        );

      res.json(
        subscriptions
      );

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Failed to detect subscriptions"
      });
    }
  }
);

// ===============================
// GET SINGLE VENDOR
// ===============================

app.get(
  "/vendors/:name",
  async (req, res) => {

    const vendorName =
      req.params.name;

    db.get(
      `
      SELECT *
      FROM vendors
      WHERE normalized_name = ?
      `,
      [vendorName],
      (error, row) => {

        if (error) {

          console.error(error);

          return res.status(500).json({
            error:
              "Failed to fetch vendor"
          });
        }

        if (!row) {

          return res.status(404).json({
            error:
              "Vendor not found"
          });
        }

        res.json(row);
      }
    );
  }
);

// ===============================
// AI CATEGORY ENDPOINT
// ===============================

app.post(
  "/categorize",
  async (req, res) => {

    try {

      const {
        vendor
      } = req.body;

      if (!vendor) {

        return res.status(400).json({
          error:
            "Vendor required"
        });
      }

      const category =
        await categorizeVendor(
          vendor
        );

      res.json({
        vendor,
        category
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "AI categorization failed"
      });
    }
  }
);

// SAVE TRANSACTIONS
// ===============================

app.post(
  "/transactions",
  async (req, res) => {

    try {

      const {
        transactions
      } = req.body;

      if (
        !Array.isArray(
          transactions
        )
      ) {

        return res.status(400).json({
          error:
            "Transactions array required"
        });
      }

      await saveTransactions(
        transactions
      );

      for (
        const transaction
        of transactions
      ) {

        if (
          !transaction.category ||
          transaction.category === "other"
        ) {

          enqueue(transaction);
        }
      }

      res.json({
        success: true,
        count: transactions.length
      });

    } catch (error) {

      console.error(
        "Transaction save failed:",
        error
      );

      res.status(500).json({
        error:
          "Failed to save transactions"
      });
    }
  }
);

// ===============================
// GET HISTORICAL TRENDS & FORECAST
// ===============================

function getMonthKey(dateStr) {
  if (!dateStr) return "Unknown";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Unknown";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  } catch {
    return "Unknown";
  }
}

app.get(
  "/analytics/trends",
  async (req, res) => {
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
  }
);

// ===============================
// MANUAL VENDOR CATEGORIZATION OVERRIDE
// ===============================
app.post("/vendors/categorize", async (req, res) => {
  try {
    const { normalizedName, category } = req.body;
    if (!normalizedName || !category) {
      return res.status(400).json({ error: "normalizedName and category required" });
    }

    // 1. Update vendors table in SQLite
    db.run(
      `UPDATE vendors SET category = ? WHERE normalized_name = ?`,
      [category, normalizedName]
    );

    // 2. Update transactions table in SQLite
    db.run(
      `UPDATE transactions SET category = ?, ai_categorized = 1 WHERE normalized_merchant = ?`,
      [category, normalizedName]
    );

    // 3. Update vendor-cache.json file cache
    try {
      const cache = loadCache();
      cache[normalizedName] = category;
      saveCache(cache);
      console.log(`Manual override saved to cache: ${normalizedName} => ${category}`);
    } catch (cacheErr) {
      console.error("Failed to update vendor file cache:", cacheErr);
    }

    res.json({ success: true, message: `Vendor ${normalizedName} updated to ${category}` });

  } catch (error) {
    console.error("Manual categorization override failed:", error);
    res.status(500).json({ error: "Failed to override vendor category" });
  }
});

// ===============================
// CLEAR ALL CACHES & TABLES
// ===============================
app.post("/vendors/clear-cache", async (req, res) => {
  try {
    // 1. Clear vendors table
    db.run("DELETE FROM vendors");
    
    // 2. Clear transactions table
    db.run("DELETE FROM transactions");
    
    // 3. Reset file cache
    saveCache({});
    
    console.log("Database tables and local cache reset successfully.");
    res.json({ success: true, message: "Vendor cache and intelligence databases successfully reset." });
  } catch (error) {
    console.error("Failed to clear database cache:", error);
    res.status(500).json({ error: "Failed to reset cache databases" });
  }
});

// ===============================
// PARSE LEGACY XLS STATEMENTS
// ===============================
app.post("/parse-xls", express.raw({ type: "application/octet-stream", limit: "10mb" }), (req, res) => {
  if (!req.body || !req.body.length) {
    return res.status(400).json({ error: "No binary data received" });
  }

  const tempDir = path.resolve("./scratch");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempFile = path.join(tempDir, `temp_${Date.now()}.xls`);

  fs.writeFile(tempFile, req.body, (err) => {
    if (err) {
      console.error("Failed to write temp file:", err);
      return res.status(500).json({ error: "Failed to write temp file" });
    }

    const scriptPath = path.resolve("./parse_xls.py");
    exec(`python "${scriptPath}" "${tempFile}"`, (execErr, stdout, stderr) => {
      // Always cleanup
      fs.unlink(tempFile, () => {});

      if (execErr) {
        console.error("Python parsing failed:", execErr, stderr);
        return res.status(500).json({ error: "XLS parser script failed" });
      }

      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) {
          return res.status(400).json({ error: parsed.error });
        }
        res.json(parsed);
      } catch (parseErr) {
        console.error("Failed to parse Python output:", parseErr, stdout);
        res.status(500).json({ error: "Invalid response from statement parser" });
      }
    });
  });
});

// ===============================
// START SERVER
// ===============================

const PORT = 3000;

app.listen(PORT, () => {

  console.log(
    `FinLens AI server running on http://localhost:${PORT}`
  );
});