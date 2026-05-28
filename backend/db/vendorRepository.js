import db from "./connection.js";
import { EXCLUDED_MERCHANT_PATTERNS } from "../helpers.js";

export function upsertVendor(transaction) {
  return new Promise((resolve, reject) => {
    const txDate = transaction.date
      ? new Date(transaction.date).toISOString()
      : new Date().toISOString();

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
        transaction_count = transaction_count + 1,
        total_spend = total_spend + excluded.total_spend,
        last_seen = excluded.last_seen,
        category = excluded.category
      `,
      [
        transaction.normalizedMerchant,
        transaction.description,
        transaction.category,
        Number(transaction.amount),
        txDate,
        txDate
      ],
      error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });
}

export function getVendors() {
  return new Promise((resolve, reject) => {
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
  });
}

export function getVendorsByAccount(accountId, limit = null) {
  return new Promise((resolve, reject) => {
    const notLikeClauses = EXCLUDED_MERCHANT_PATTERNS.map(() => `merchant NOT LIKE ?`).join(" AND ");
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
      WHERE type = 'debit' AND (${notLikeClauses})
    `;
    
    const params = EXCLUDED_MERCHANT_PATTERNS.map(pattern => `%${pattern}%`);
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

          if (
            normalizedName.includes("talekar") ||
            normalizedName.includes("swati") ||
            normalizedName.includes("nilesh") ||
            normalizedName.includes("nishita")
          ) {
            db.run(
              `UPDATE transactions SET category = 'family', ai_categorized = 1 WHERE normalized_merchant = ? AND type = 'debit'`,
              [normalizedName],
              (err2) => {
                if (err2) {
                  reject(err2);
                  return;
                }
                db.run(
                  `UPDATE transactions SET category = 'reimbursement', ai_categorized = 1 WHERE normalized_merchant = ? AND type = 'credit'`,
                  [normalizedName],
                  (err3) => {
                    if (err3) reject(err3);
                    else resolve();
                  }
                );
              }
            );
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

export function clearVendors() {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM vendors", error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
