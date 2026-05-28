import crypto from "crypto";
import db from "./connection.js";
import { isSpendTransaction } from "../helpers.js";
import { upsertVendor } from "./vendorRepository.js";

export function generateTransactionHash(transaction) {
  // Always normalize date string to YYYY-MM-DD format for deduplication consistency
  let dateStr = "";
  if (transaction.date) {
    const d = new Date(transaction.date);
    if (!isNaN(d.getTime())) {
      dateStr = d.toISOString().split("T")[0];
    }
  }

  // Ensure amount is parsed as number and formatted cleanly to 2 decimal places
  const amountVal = Number(transaction.amount || 0).toFixed(2);

  // Normalize merchant description and type to be lowercase and trimmed
  const desc = (transaction.description || "").trim().toLowerCase();
  const normMerchant = (transaction.normalizedMerchant || transaction.normalized_merchant || "").trim().toLowerCase();
  const type = (transaction.type || "").trim().toLowerCase();

  const raw = [
    dateStr,
    amountVal,
    normMerchant,
    desc,
    type
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex");
}

export async function saveTransactions(transactions) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO transactions (
        date,
        merchant,
        normalized_merchant,
        amount,
        category,
        type,
        transaction_hash,
        ai_categorized,
        source_bank,
        statement_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
      UPDATE transactions 
      SET source_bank = ?, 
          statement_date = ? 
      WHERE transaction_hash = ? AND (source_bank IS NULL OR source_bank = '' OR source_bank = 'HDFC')
    `);

    db.serialize(async () => {
      try {
        for (const transaction of transactions) {
          const hash = generateTransactionHash(transaction);

          const normalizedDate = transaction.date
            ? new Date(transaction.date).toISOString()
            : null;

          stmt.run(
            normalizedDate,
            transaction.description,
            transaction.normalizedMerchant,
            Number(transaction.amount),
            transaction.category,
            transaction.type,
            hash,
            transaction.aiCategorized ? 1 : 0,
            transaction.sourceBank || "HDFC",
            transaction.statementDate || null
          );

          updateStmt.run(
            transaction.sourceBank || "HDFC",
            transaction.statementDate || null,
            hash
          );

          if (isSpendTransaction(transaction)) {
            await upsertVendor(transaction);
          }
        }

        stmt.finalize();
        updateStmt.finalize(error => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function getTransactions(accountId) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT *
      FROM transactions
    `;
    const params = [];
    if (accountId && accountId !== "all") {
      query += ` WHERE source_bank = ?`;
      params.push(accountId);
    }
    query += ` ORDER BY date DESC`;

    db.all(query, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

export function clearTransactions() {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM transactions", error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export function linkTransactions(debitHash, creditHash) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE transactions SET linked_transaction_hash = ? WHERE transaction_hash = ?`,
      [creditHash || null, debitHash],
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });
}
