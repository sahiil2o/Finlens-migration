import sqlite3 from "sqlite3";
import fs from "fs";
import crypto from "crypto";

import path from "path";
import { fileURLToPath } from "url";

// ===============================
// ABSOLUTE DB PATH
// ===============================

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const dbPath =
  path.join(
    __dirname,
    "finlens.db"
  );

// ===============================
// DATABASE
// ===============================

const db =
  new sqlite3.Database(
    dbPath
  );

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
// EXPORT DB
// ===============================

export default db;