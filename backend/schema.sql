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