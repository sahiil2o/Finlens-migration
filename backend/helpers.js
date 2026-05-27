// ==========================================
// BACKEND ANALYTICAL UTILITIES
// ==========================================

/**
 * Normalizes database transaction rows into application-standard formats.
 * 
 * @param {Array} rows - SQLite raw database rows
 * @returns {Array} Normalized transaction objects
 */
export function normalizeTransactions(rows) {
  return rows.map(row => {
    const parsedDate = row.date ? new Date(row.date) : null;
    const dateString = parsedDate && !isNaN(parsedDate)
      ? parsedDate.toLocaleDateString("en-GB")
      : "—";

    return {
      ...row,
      description: row.merchant,
      normalizedMerchant: row.normalized_merchant,
      sourceBank: row.source_bank,
      statementDate: row.statement_date,
      dateString
    };
  });
}

/**
 * Checks if a transaction represents an outflow spend.
 * 
 * @param {Object} transaction - Transaction record
 * @returns {boolean} True if it is a spend outflow
 */
export function isSpendTransaction(transaction) {
  if (transaction.type !== "debit") return false;

  const description = transaction.merchant?.toLowerCase() || "";
  const excludedPatterns = [
    "autopay",
    "thank you",
    "credit card",
    "card payment",
    "cc payment",
    "refund",
    "reversal",
    "cashback"
  ];

  return !excludedPatterns.some(pattern => description.includes(pattern));
}

/**
 * Slices transactions chronologically and detects monthly recurring subscription patterns.
 * 
 * @param {Array} transactions - List of transactions
 * @returns {Array} List of detected subscriptions
 */
export function detectRecurringSubscriptions(transactions) {
  const grouped = {};

  for (const transaction of transactions) {
    if (!isSpendTransaction(transaction)) continue;

    const merchant = transaction.normalized_merchant;
    if (!merchant) continue;

    if (!grouped[merchant]) {
      grouped[merchant] = [];
    }
    grouped[merchant].push(transaction);
  }

  const subscriptions = [];

  for (const [merchant, vendorTransactions] of Object.entries(grouped)) {
    if (vendorTransactions.length < 2) continue;

    // Sort by date ascending
    vendorTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate Average Amount
    const avgAmount = vendorTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0) / vendorTransactions.length;

    // Check Amount Consistency
    const similarAmounts = vendorTransactions.every(transaction => {
      const diff = Math.abs(Number(transaction.amount) - avgAmount);
      return diff < (avgAmount * 0.25);
    });

    if (!similarAmounts) continue;

    // Calculate Gaps (in days)
    const gaps = [];
    for (let i = 1; i < vendorTransactions.length; i++) {
      const prev = new Date(vendorTransactions[i - 1].date);
      const curr = new Date(vendorTransactions[i].date);
      const days = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      gaps.push(days);
    }

    // Check Monthly-like Pattern (20 to 40 days gap)
    const recurring = gaps.every(gap => gap >= 20 && gap <= 40);
    if (!recurring) continue;

    // Confidence Scoring
    let confidence = 60;
    if (vendorTransactions.length >= 3) confidence += 15;
    if (vendorTransactions.length >= 5) confidence += 15;
    confidence = Math.min(confidence, 95);

    subscriptions.push({
      merchant,
      displayName: vendorTransactions[0].merchant,
      category: vendorTransactions[0].category,
      recurringCount: vendorTransactions.length,
      averageAmount: avgAmount,
      lastCharge: vendorTransactions.at(-1).date,
      averageGapDays: Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length),
      confidence
    });
  }

  subscriptions.sort((a, b) => b.confidence - a.confidence);
  return subscriptions;
}

/**
 * Returns a Year-Month key for monthly category aggregations.
 * 
 * @param {string} dateStr - Date string
 * @returns {string} Key in the format "YYYY-MM" or "Unknown"
 */
export function getMonthKey(dateStr) {
  if (!dateStr) return "Unknown";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Unknown";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  } catch {
    return "Unknown";
  }
}
