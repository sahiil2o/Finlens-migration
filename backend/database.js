import sqlite3 from "sqlite3";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

import { DB_PATH } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// DATABASE
// ===============================

const db = new sqlite3.Database(DB_PATH);

// ===============================
// INIT DATABASE
// ===============================

export function initializeDatabase() {

  const schemaPath =
    path.join(
      __dirname,
      "schema.sql"
    );

  const schema =
    fs.readFileSync(
      schemaPath,
      "utf-8"
    );

  db.exec(schema, error => {

    if (error) {

      console.error(
        "Schema init failed:",
        error
      );

      return;
    }

    console.log(
      "SQLite initialized"
    );
  });
}

// ===============================
// HASH GENERATOR
// ===============================

function generateTransactionHash(
  transaction
) {

  const raw = [

    transaction.date,

    transaction.amount,

    transaction.normalizedMerchant,

    transaction.description,

    transaction.type

  ].join("|");

  return crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex");
}

// ===============================
// VALID SPEND CHECK
// ===============================

function isSpendTransaction(
  transaction
) {

  // ===========================
  // ONLY DEBITS
  // ===========================

  if (
    transaction.type !== "debit"
  ) {

    return false;
  }

  const description =

    transaction.description
      ?.toLowerCase() || "";

  // ===========================
  // EXCLUDE REPAYMENTS
  // ===========================

  const excludedPatterns = [

    "autopay",

    "thank you",

    "credit card",

    "card payment",

    "cc payment",

    "payment received",

    "cashback",

    "reversal",

    "refund"
  ];

  return !excludedPatterns.some(
    pattern =>

      description.includes(
        pattern
      )
  );
}

// ===============================
// INSERT / UPDATE VENDOR
// ===============================

function upsertVendor(
  transaction
) {

  return new Promise(
    (resolve, reject) => {

      const today =
        new Date()
          .toISOString();

      db.run(
        `
        INSERT INTO vendors (

          normalized_name,

          display_name,

          category,

          transaction_count,

          total_spend,

          first_seen,

          last_seen

        )

        VALUES (
          ?, ?, ?, 1, ?, ?, ?
        )

        ON CONFLICT(normalized_name)

        DO UPDATE SET

          transaction_count =
            transaction_count + 1,

          total_spend =
            total_spend
            + excluded.total_spend,

          last_seen =
            excluded.last_seen,

          category =
            excluded.category
        `,
        [

          transaction.normalizedMerchant,

          transaction.description,

          transaction.category,

          Number(
            transaction.amount
          ),

          today,

          today
        ],
        error => {

          if (error) {

            reject(error);

            return;
          }

          resolve();
        }
      );
    }
  );
}

// ===============================
// SAVE TRANSACTIONS
// ===============================

export async function saveTransactions(
  transactions
) {

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

        for (
          const transaction
          of transactions
        ) {

          const hash =
            generateTransactionHash(
              transaction
            );

          // =====================
          // NORMALIZE DATE
          // =====================

          const normalizedDate =

            transaction.date

              ? new Date(
                  transaction.date
                ).toISOString()

              : null;

          // =====================
          // INSERT TRANSACTION
          // =====================

          stmt.run(

            // date
            normalizedDate,

            // merchant
            transaction.description,

            // normalized_merchant
            transaction.normalizedMerchant,

            // amount
            Number(
              transaction.amount
            ),

            // category
            transaction.category,

            // type
            transaction.type,

            // transaction_hash
            hash,

            // ai_categorized
            transaction.aiCategorized
              ? 1
              : 0,

            // source_bank
            transaction.sourceBank || "HDFC",

            // statement_date
            transaction.statementDate || null
          );

          // Defensive update to heal any existing records with missing card metadata
          updateStmt.run(
            transaction.sourceBank || "HDFC",
            transaction.statementDate || null,
            hash
          );

          // =====================
          // ONLY TRACK
          // ACTUAL SPEND
          // =====================

          if (
            isSpendTransaction(
              transaction
            )
          ) {

            await upsertVendor(
              transaction
            );
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

// ===============================
// GET ALL TRANSACTIONS
// ===============================

export function getTransactions() {

  return new Promise(
    (resolve, reject) => {

      db.all(
        `
        SELECT *
        FROM transactions
        ORDER BY date DESC
        `,
        [],
        (error, rows) => {

          if (error) {

            reject(error);

            return;
          }

          resolve(rows);
        }
      );
    }
  );
}

// ===============================
// GET VENDORS
// ===============================

export function getVendors() {

  return new Promise(
    (resolve, reject) => {

      db.all(
        `
        SELECT *
        FROM vendors
        ORDER BY total_spend DESC
        `,
        [],
        (error, rows) => {

          if (error) {

            reject(error);

            return;
          }

          resolve(rows);
        }
      );
    }
  );
}

// ===============================
// GET & SAVE ACCOUNT METADATA
// ===============================

export function saveAccountMetadata(meta) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM account_metadata WHERE account_id = ?`,
      [meta.accountId],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

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

        let shouldUpdate = true;
        if (row) {
          const existingDate = parseDateStr(row.stmt_date);
          const newDate = parseDateStr(meta.stmtDate);
          if (newDate < existingDate) {
            shouldUpdate = false;
          }
        }

        if (shouldUpdate) {
          db.run(
            `INSERT INTO account_metadata (
              account_id, account_type, card_last4, stmt_date, due_date, 
              total_due, min_due, credit_limit, available_limit, od_limit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(account_id) DO UPDATE SET
              account_type = excluded.account_type,
              card_last4 = excluded.card_last4,
              stmt_date = excluded.stmt_date,
              due_date = COALESCE(excluded.due_date, due_date),
              total_due = excluded.total_due,
              min_due = COALESCE(excluded.min_due, min_due),
              credit_limit = COALESCE(excluded.credit_limit, credit_limit),
              available_limit = COALESCE(excluded.available_limit, available_limit),
              od_limit = COALESCE(excluded.od_limit, od_limit)`,
            [
              meta.accountId,
              meta.accountType || "credit",
              meta.cardLast4 || "",
              meta.stmtDate || "",
              meta.dueDate || null,
              Number(meta.totalDue) || 0,
              Number(meta.minDue) || 0,
              Number(meta.creditLimit) || 0,
              Number(meta.availableLimit) || 0,
              Number(meta.odLimit) || 0
            ],
            (error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            }
          );
        } else {
          db.run(
            `UPDATE account_metadata SET
              od_limit = CASE WHEN ? > 0 THEN ? ELSE od_limit END,
              credit_limit = CASE WHEN ? > 0 THEN ? ELSE credit_limit END,
              card_last4 = CASE WHEN ? != '' THEN ? ELSE card_last4 END,
              account_type = ?
            WHERE account_id = ?`,
            [
              Number(meta.odLimit) || 0, Number(meta.odLimit) || 0,
              Number(meta.creditLimit) || 0, Number(meta.creditLimit) || 0,
              meta.cardLast4 || "", meta.cardLast4 || "",
              meta.accountType || "credit",
              meta.accountId
            ],
            (error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            }
          );
        }
      }
    );
  });
}

export function getAccountMetadata() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM account_metadata`, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// ===============================
// REPOSITORY HELPERS (STEP 2)
// ===============================

export function getVendorsByAccount(accountId, limit = null) {
  return new Promise((resolve, reject) => {
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
    
    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    db.all(query, params, (error, rows) => {
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    });
  });
}

export function getVendorByNormalizedName(normalizedName) {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT *
      FROM vendors
      WHERE normalized_name = ?
      `,
      [normalizedName],
      (error, row) => {
        if (error) {
          reject(error);
        } else {
          resolve(row);
        }
      }
    );
  });
}

export function updateVendorCategory(normalizedName, category) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `UPDATE vendors SET category = ? WHERE normalized_name = ?`,
        [category, normalizedName],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          db.run(
            `UPDATE transactions SET category = ?, ai_categorized = 1 WHERE normalized_merchant = ?`,
            [category, normalizedName],
            (err2) => {
              if (err2) {
                reject(err2);
              } else {
                resolve();
              }
            }
          );
        }
      );
    });
  });
}

export function clearTransactionsAndVendors() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("DELETE FROM vendors", (err) => {
        if (err) {
          reject(err);
          return;
        }
        db.run("DELETE FROM transactions", (err2) => {
          if (err2) {
            reject(err2);
          } else {
            resolve();
          }
        });
      });
    });
  });
}

// ===============================
// EXPORT DB
// ===============================

export default db;