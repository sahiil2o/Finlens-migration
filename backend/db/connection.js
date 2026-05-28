import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DB_PATH } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new sqlite3.Database(DB_PATH);

const migrations = [
  {
    id: 1,
    name: "add_linked_transaction_hash_to_transactions",
    sql: "ALTER TABLE transactions ADD COLUMN linked_transaction_hash TEXT;"
  }
];

export function initializeDatabase() {
  const schemaPath = path.resolve(__dirname, "../schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  db.exec(schema, error => {
    if (error) {
      console.error("Schema init failed:", error);
      return;
    }
    console.log("SQLite schema base setup complete");

    runMigrations();
  });
}

function runMigrations() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS db_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `, (err) => {
      if (err) {
        console.error("Failed to create db_migrations table:", err);
        return;
      }

      db.all("SELECT id FROM db_migrations", (err, rows) => {
        if (err) {
          console.error("Failed to query db_migrations table:", err);
          return;
        }

        const appliedIds = new Set(rows.map(r => r.id));
        const pending = migrations.filter(m => !appliedIds.has(m.id));

        if (pending.length === 0) {
          console.log("[Migration] No pending migrations to apply");
          return;
        }

        let i = 0;
        function next() {
          if (i >= pending.length) {
            console.log("[Migration] All migrations checked and applied successfully");
            return;
          }
          const migration = pending[i];
          console.log(`[Migration] Applying database migration [${migration.id}]: ${migration.name}...`);
          
          db.serialize(() => {
            db.run("BEGIN TRANSACTION;", (err) => {
              if (err) {
                console.error(`[Migration] Failed to begin transaction for migration [${migration.id}]`, err);
                i++;
                next();
                return;
              }

              db.run(migration.sql, (err) => {
                if (err) {
                  console.error(`[Migration] Migration failed [${migration.id}]: ${migration.name}. Rolling back.`, err);
                  db.run("ROLLBACK;", () => {
                    i++;
                    next();
                  });
                  return;
                }

                db.run("INSERT INTO db_migrations (id, name) VALUES (?, ?);", [migration.id, migration.name], (err) => {
                  if (err) {
                    console.error(`[Migration] Failed to record migration [${migration.id}]: ${migration.name}. Rolling back.`, err);
                    db.run("ROLLBACK;", () => {
                      i++;
                      next();
                    });
                  } else {
                    db.run("COMMIT;", (err) => {
                      if (err) {
                        console.error(`[Migration] Failed to commit migration [${migration.id}]: ${migration.name}`, err);
                      } else {
                        console.log(`[Migration] Migration applied successfully [${migration.id}]: ${migration.name}`);
                      }
                      i++;
                      next();
                    });
                  }
                });
              });
            });
          });
        }

        next();
      });
    });
  });
}

export default db;
