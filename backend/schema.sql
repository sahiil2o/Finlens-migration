CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_hash TEXT UNIQUE,
    date TEXT,
    merchant TEXT,
    normalized_merchant TEXT,
    amount REAL,
    type TEXT,
    category TEXT,
    ai_categorized INTEGER DEFAULT 0,
    source_bank TEXT,
    statement_date TEXT,
    linked_transaction_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    normalized_name TEXT UNIQUE,
    display_name TEXT,
    category TEXT,
    transaction_count INTEGER DEFAULT 0,
    total_spend REAL DEFAULT 0,
    first_seen TEXT,
    last_seen TEXT
);
CREATE TABLE IF NOT EXISTS account_metadata (
    account_id TEXT PRIMARY KEY,
    account_type TEXT,
    card_last4 TEXT,
    stmt_date TEXT,
    due_date TEXT,
    total_due REAL,
    min_due REAL,
    credit_limit REAL,
    available_limit REAL,
    od_limit REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_normalized_merchant 
  ON transactions(normalized_merchant);
CREATE INDEX IF NOT EXISTS idx_transactions_source_bank 
  ON transactions(source_bank);
CREATE INDEX IF NOT EXISTS idx_transactions_date 
  ON transactions(date);