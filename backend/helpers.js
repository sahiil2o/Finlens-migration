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
      transactionHash: row.transaction_hash,
      description: row.merchant,
      normalizedMerchant: row.normalized_merchant,
      sourceBank: row.source_bank,
      statementDate: row.statement_date,
      linkedTransactionHash: row.linked_transaction_hash,
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
export const EXCLUDED_MERCHANT_PATTERNS = [
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

export function isSpendTransaction(transaction) {
  if (transaction.type !== "debit") return false;

  const description = transaction.merchant?.toLowerCase() || "";

  return !EXCLUDED_MERCHANT_PATTERNS.some(pattern => description.includes(pattern));
}

/**
 * Slices transactions chronologically and detects monthly recurring subscription patterns.
 * 
 * @param {Array} transactions - List of transactions
 * @returns {Array} List of detected subscriptions
 */
export function getBrandName(merchant) {
  if (!merchant) return "";
  const m = merchant.toLowerCase();
  if (m.includes("netflix")) return "netflix";
  if (m.includes("spotify")) return "spotify";
  if (m.includes("youtube")) return "youtube";
  if (m.includes("apple")) return "apple";
  if (m.includes("amazon prime") || m.includes("prime video") || m.includes("prime member")) return "amazon prime";
  if (m.includes("hotstar")) return "hotstar";
  if (m.includes("google")) return "google";
  if (m.includes("jio")) return "jio";
  if (m.includes("airtel")) return "airtel";
  return merchant;
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

    const brand = getBrandName(merchant);
    if (!grouped[brand]) {
      grouped[brand] = [];
    }
    grouped[brand].push(transaction);
  }

  const subscriptions = [];
  const utilityKeywords = ["utility", "telecom", "bill", "electricity", "broadband", "mobile", "power", "recharge", "gas", "water", "insurance"];

  for (const [brandKey, vendorTransactions] of Object.entries(grouped)) {
    if (vendorTransactions.length < 2) continue;

    // Sort by date ascending
    vendorTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Focus on the latest transaction's amount to ignore historical plan/tier pricing outliers
    const latestTxn = vendorTransactions[vendorTransactions.length - 1];
    const latestAmount = Number(latestTxn.amount);
    
    const merchantLower = (latestTxn.merchant || "").toLowerCase();
    const isUtility = utilityKeywords.some(keyword => merchantLower.includes(keyword)) || 
                      (latestTxn.category === "bills" || latestTxn.category === "rent");
    const varianceLimit = isUtility ? 0.45 : 0.15; // 45% variance limit for utilities, 15% for SaaS

    const activeTxns = vendorTransactions.filter(t => {
      const diff = Math.abs(Number(t.amount) - latestAmount);
      return diff <= (latestAmount * varianceLimit);
    });

    if (activeTxns.length < 2) continue;

    // 1. Calculate Gaps & Filter Retry Anomalies
    const rawGaps = [];
    for (let i = 1; i < activeTxns.length; i++) {
      const prev = new Date(activeTxns[i - 1].date);
      const curr = new Date(activeTxns[i].date);
      const days = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      rawGaps.push(days);
    }

    const filteredGaps = rawGaps.filter(gap => gap >= 3);
    if (filteredGaps.length < 1) continue;

    // 2. Median Interval Check
    const sortedGaps = [...filteredGaps].sort((a, b) => a - b);
    const mid = Math.floor(sortedGaps.length / 2);
    const medianGap = sortedGaps.length % 2 !== 0 ? sortedGaps[mid] : Math.round((sortedGaps[mid - 1] + sortedGaps[mid]) / 2);

    // 3. Frequency Validation
    let frequency = "unknown";
    let minGap = 0;
    let maxGap = 0;

    if (medianGap >= 5 && medianGap <= 10) {
      frequency = "weekly";
      minGap = 5;
      maxGap = 10;
    } else if (medianGap >= 11 && medianGap <= 18) {
      frequency = "bi-weekly";
      minGap = 11;
      maxGap = 18;
    } else if (medianGap >= 22 && medianGap <= 38) {
      frequency = "monthly";
      minGap = 22;
      maxGap = 38;
    } else if (medianGap >= 75 && medianGap <= 105) {
      frequency = "quarterly";
      minGap = 75;
      maxGap = 105;
    }

    if (frequency === "unknown") continue;

    // Require majority (>= 70%) of filtered gaps to align with detected interval range
    const matchingGaps = filteredGaps.filter(gap => gap >= minGap && gap <= maxGap);
    const gapMatchRatio = matchingGaps.length / filteredGaps.length;
    if (gapMatchRatio < 0.7) continue;

    // 4. Calculate Average Amount (using the filtered active list)
    const avgAmount = activeTxns.reduce((sum, t) => sum + Number(t.amount), 0) / activeTxns.length;

    // 5. Confidence Scoring
    let confidence = 55;

    // Length weights
    if (activeTxns.length === 3) confidence += 15;
    else if (activeTxns.length === 4) confidence += 20;
    else if (activeTxns.length >= 5) confidence += 30;

    // Gap consistency weight
    const gapDeviations = filteredGaps.map(gap => Math.abs(gap - medianGap));
    const avgGapDeviation = gapDeviations.reduce((a, b) => a + b, 0) / gapDeviations.length;
    if (avgGapDeviation <= 1.5) confidence += 10;
    else if (avgGapDeviation <= 3) confidence += 5;

    // SaaS amount stability bonus
    if (!isUtility) {
      const amountDeviations = activeTxns.map(t => Math.abs(Number(t.amount) - avgAmount));
      const avgAmtDeviation = amountDeviations.reduce((a, b) => a + b, 0) / amountDeviations.length;
      if (avgAmtDeviation <= avgAmount * 0.05) confidence += 10;
    }

    confidence = Math.min(Math.max(confidence, 40), 99);

    // Format display name nicely
    let displayName = latestTxn.merchant;
    if (brandKey === "netflix") displayName = "Netflix";
    else if (brandKey === "spotify") displayName = "Spotify";
    else if (brandKey === "youtube") displayName = "YouTube";
    else if (brandKey === "amazon prime") displayName = "Amazon Prime";

    subscriptions.push({
      merchant: brandKey,
      displayName,
      category: activeTxns[0].category,
      recurringCount: activeTxns.length,
      averageAmount: avgAmount,
      lastCharge: activeTxns.at(-1).date,
      averageGapDays: Math.round(filteredGaps.reduce((a, b) => a + b, 0) / filteredGaps.length),
      confidence,
      frequency
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
