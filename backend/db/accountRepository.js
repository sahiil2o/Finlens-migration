import db from "./connection.js";

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
