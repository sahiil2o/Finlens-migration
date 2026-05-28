// ==========================================
// TRANSACTIONS CONTROLLER HANDLERS
// ==========================================

import fs from "fs";
import path from "path";
import { execFile } from "child_process";

import {
  saveTransactions,
  getTransactions,
  saveAccountMetadata,
  getAccountMetadata,
  linkTransactions
} from "../db/index.js";

import { normalizeTransactions } from "../helpers.js";
import { enqueue } from "../aiQueue.js";

/**
 * GET /transactions
 * Retrieves all transactions from SQLite, formats and normalizes them, and returns.
 */
export async function getTransactionsHandler(req, res) {
  try {
    const rows = await getTransactions();
    const normalizedRows = normalizeTransactions(rows);
    res.json(normalizedRows);
  } catch (error) {
    console.error("[TransactionsController] getTransactions failed:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
}

/**
 * POST /transactions
 * Persists transaction statements into the database, queuing new entries for AI enrichment.
 */
export async function saveTransactionsHandler(req, res) {
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
    console.error("[TransactionsController] saveTransactions failed:", error);
    res.status(500).json({ error: "Failed to save transactions" });
  }
}

/**
 * POST /metadata
 * Persists dynamic statement limits/metadata for a given account.
 */
export async function saveMetadataHandler(req, res) {
  try {
    const { metadata } = req.body;
    if (!metadata || !metadata.accountId) {
      return res.status(400).json({ error: "Metadata with accountId required" });
    }
    await saveAccountMetadata(metadata);
    res.json({ success: true });
  } catch (error) {
    console.error("[TransactionsController] saveMetadata failed:", error);
    res.status(500).json({ error: "Failed to save metadata" });
  }
}

/**
 * GET /metadata
 * Retrieves account statements metadata.
 */
export async function getMetadataHandler(req, res) {
  try {
    const rows = await getAccountMetadata();
    res.json(rows);
  } catch (error) {
    console.error("[TransactionsController] getMetadata failed:", error);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
}

/**
 * POST /parse-xls
 * Receives binary XLS files, resolves them to temp files on disk, and delegates to python parser.
 */
export function parseXlsHandler(req, res) {
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
      console.error("[TransactionsController] temp file write failed:", err);
      return res.status(500).json({ error: "Failed to write temp file" });
    }

    const scriptPath = path.resolve("./parse_xls.py");
    execFile("python", [scriptPath, tempFile], (execErr, stdout, stderr) => {
      // Always cleanup
      fs.unlink(tempFile, () => {});

      if (execErr) {
        console.error("[TransactionsController] Python parsing script execution failed:", execErr, stderr);
        return res.status(500).json({ error: "XLS parser script failed" });
      }

      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) {
          return res.status(400).json({ error: parsed.error });
        }
        res.json(parsed);
      } catch (parseErr) {
        console.error("[TransactionsController] Python output JSON parsing failed:", parseErr, stdout);
        res.status(500).json({ error: "Invalid response from statement parser" });
      }
    });
  });
}

/**
 * POST /transactions/link
 * Links a credit transaction hash to a debit transaction hash.
 */
export async function linkTransactionsHandler(req, res) {
  try {
    const { debitHash, creditHash } = req.body;
    if (!debitHash) {
      return res.status(400).json({ error: "debitHash is required" });
    }
    await linkTransactions(debitHash, creditHash);
    res.json({ success: true, message: "Transaction linking state updated successfully." });
  } catch (error) {
    console.error("[TransactionsController] linkTransactions failed:", error);
    res.status(500).json({ error: "Failed to link transactions" });
  }
}
