import express from "express";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

import {
  saveTransactions,
  getTransactions,
  saveAccountMetadata,
  getAccountMetadata
} from "../database.js";

import { normalizeTransactions } from "../helpers.js";
import { enqueue } from "../aiQueue.js";

const router = express.Router();

// ===============================
// GET TRANSACTIONS
// ===============================
router.get("/transactions", async (req, res) => {
  try {
    const rows = await getTransactions();
    const normalizedRows = normalizeTransactions(rows);
    res.json(normalizedRows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ===============================
// SAVE TRANSACTIONS
// ===============================
router.post("/transactions", async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: "Transactions array required" });
    }

    await saveTransactions(transactions);

    for (const transaction of transactions) {
      if (!transaction.category || transaction.category === "other") {
        enqueue(transaction);
      }
    }

    res.json({
      success: true,
      count: transactions.length
    });
  } catch (error) {
    console.error("Transaction save failed:", error);
    res.status(500).json({ error: "Failed to save transactions" });
  }
});

// ===============================
// GET & POST ACCOUNT METADATA
// ===============================
router.post("/metadata", async (req, res) => {
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
});

router.get("/metadata", async (req, res) => {
  try {
    const rows = await getAccountMetadata();
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch metadata:", error);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

// ===============================
// PARSE LEGACY XLS STATEMENTS
// ===============================
router.post("/parse-xls", express.raw({ type: "application/octet-stream", limit: "10mb" }), (req, res) => {
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

export default router;
