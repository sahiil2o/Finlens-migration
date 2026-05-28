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
export async function getTransactionsHandler(req, res, next) {
  try {
    const rows = await getTransactions();
    const normalizedRows = normalizeTransactions(rows);
    res.json(normalizedRows);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /transactions
 * Persists transaction statements into the database, queuing new entries for AI enrichment.
 */
export async function saveTransactionsHandler(req, res, next) {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions)) {
      const err = new Error("Transactions array required");
      err.status = 400;
      return next(err);
    }

    // Validate transactions array content
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (!tx.date || typeof tx.date !== "string" || !tx.date.trim()) {
        const err = new Error(`Transaction at index ${i} is missing a valid date`);
        err.status = 400;
        return next(err);
      }
      if (!tx.description || typeof tx.description !== "string" || !tx.description.trim()) {
        const err = new Error(`Transaction at index ${i} is missing a valid description`);
        err.status = 400;
        return next(err);
      }
      if (typeof tx.amount !== "number" || isNaN(tx.amount)) {
        const err = new Error(`Transaction at index ${i} must have a numeric amount`);
        err.status = 400;
        return next(err);
      }
      if (tx.type !== "debit" && tx.type !== "credit") {
        const err = new Error(`Transaction at index ${i} has invalid type: "${tx.type}". Must be 'debit' or 'credit'`);
        err.status = 400;
        return next(err);
      }
      if (!tx.accountId || typeof tx.accountId !== "string" || !tx.accountId.trim()) {
        const err = new Error(`Transaction at index ${i} is missing a valid accountId`);
        err.status = 400;
        return next(err);
      }
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
    next(error);
  }
}

/**
 * POST /metadata
 * Persists dynamic statement limits/metadata for a given account.
 */
export async function saveMetadataHandler(req, res, next) {
  try {
    const { metadata } = req.body;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      const err = new Error("Metadata object is required");
      err.status = 400;
      return next(err);
    }
    if (!metadata.accountId || typeof metadata.accountId !== "string" || !metadata.accountId.trim()) {
      const err = new Error("Metadata with accountId string is required");
      err.status = 400;
      return next(err);
    }

    // Optional fields validations
    if (metadata.limitAmount !== undefined && (typeof metadata.limitAmount !== "number" || isNaN(metadata.limitAmount))) {
      const err = new Error("limitAmount must be a valid number");
      err.status = 400;
      return next(err);
    }
    if (metadata.dueAmount !== undefined && (typeof metadata.dueAmount !== "number" || isNaN(metadata.dueAmount))) {
      const err = new Error("dueAmount must be a valid number");
      err.status = 400;
      return next(err);
    }

    await saveAccountMetadata(metadata);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /metadata
 * Retrieves account statements metadata.
 */
export async function getMetadataHandler(req, res, next) {
  try {
    const rows = await getAccountMetadata();
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /parse-xls
 * Receives binary XLS files, resolves them to temp files on disk, and delegates to python parser.
 */
export function parseXlsHandler(req, res, next) {
  if (!req.body || !Buffer.isBuffer(req.body) || !req.body.length) {
    const err = new Error("No binary data received");
    err.status = 400;
    return next(err);
  }

  const tempDir = path.resolve("./scratch");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempFile = path.join(tempDir, `temp_${Date.now()}.xls`);

  fs.writeFile(tempFile, req.body, (err) => {
    if (err) {
      console.error("[TransactionsController] temp file write failed:", err);
      const writeErr = new Error("Failed to write temp file");
      writeErr.status = 500;
      return next(writeErr);
    }

    const scriptPath = path.resolve("./parse_xls.py");
    execFile("python", [scriptPath, tempFile], (execErr, stdout, stderr) => {
      // Always cleanup
      fs.unlink(tempFile, () => {});

      if (execErr) {
        console.error("[TransactionsController] Python parsing script execution failed:", execErr, stderr);
        const execFailedErr = new Error("XLS parser script failed");
        execFailedErr.status = 500;
        return next(execFailedErr);
      }

      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) {
          const apiErr = new Error(parsed.error);
          apiErr.status = 400;
          return next(apiErr);
        }
        res.json(parsed);
      } catch (parseErr) {
        console.error("[TransactionsController] Python output JSON parsing failed:", parseErr, stdout);
        const formatErr = new Error("Invalid response from statement parser");
        formatErr.status = 500;
        return next(formatErr);
      }
    });
  });
}

/**
 * POST /transactions/link
 * Links a credit transaction hash to a debit transaction hash.
 */
export async function linkTransactionsHandler(req, res, next) {
  try {
    const { debitHash, creditHash } = req.body;
    if (!debitHash || typeof debitHash !== "string" || !debitHash.trim()) {
      const err = new Error("debitHash is required and must be a string");
      err.status = 400;
      return next(err);
    }
    if (creditHash !== undefined && creditHash !== null && typeof creditHash !== "string") {
      const err = new Error("creditHash must be a string or null");
      err.status = 400;
      return next(err);
    }
    await linkTransactions(debitHash, creditHash);
    res.json({ success: true, message: "Transaction linking state updated successfully." });
  } catch (error) {
    next(error);
  }
}
