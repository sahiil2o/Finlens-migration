import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DB_PATH } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new sqlite3.Database(DB_PATH);

export function initializeDatabase() {
  const schemaPath = path.resolve(__dirname, "../schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  db.exec(schema, error => {
    if (error) {
      console.error("Schema init failed:", error);
      return;
    }
    console.log("SQLite initialized");

    // Dynamic schema migration: add linked_transaction_hash if it doesn't exist
    db.exec("ALTER TABLE transactions ADD COLUMN linked_transaction_hash TEXT;", err => {
      if (err && !err.message.includes("duplicate column name")) {
        console.error("Migration failed to add linked_transaction_hash:", err);
      }
    });
  });
}

export default db;
