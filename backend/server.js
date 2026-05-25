import express from "express";
import cors from "cors";

import db from "./database.js";

import { categorizeVendor } from "./ai.js";

import {
  initializeDatabase,
  saveTransactions,
  getTransactions,
  getVendors
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

      // Frontend compatibility
      description:
        row.merchant,

      normalizedMerchant:
        row.normalized_merchant,

      dateString
    };
  });
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
// GET ALL VENDORS
// ===============================

app.get(
  "/vendors",
  async (req, res) => {

    try {

      const vendors =
        await getVendors();

      res.json(vendors);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Failed to fetch vendors"
      });
    }
  }
);

// ===============================
// GET TOP VENDORS
// ===============================

app.get(
  "/vendors/top",
  async (req, res) => {

    db.all(
      `
      SELECT *
      FROM vendors
      ORDER BY total_spend DESC
      LIMIT 10
      `,
      [],
      (error, rows) => {

        if (error) {

          console.error(error);

          return res.status(500).json({
            error:
              "Failed to fetch top vendors"
          });
        }

        res.json(rows);
      }
    );
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

// ===============================
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

      // ===========================
      // SAVE TO SQLITE
      // ===========================

      await saveTransactions(
        transactions
      );

      // ===========================
      // AI ENRICHMENT QUEUE
      // ===========================

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

      // ===========================
      // RESPONSE
      // ===========================

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
// START SERVER
// ===============================

const PORT = 3000;

app.listen(PORT, () => {

  console.log(
    `FinLens AI server running on http://localhost:${PORT}`
  );
});