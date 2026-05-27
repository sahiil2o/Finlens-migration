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
  const utilityKeywords = ["utility", "telecom", "bill", "electricity", "broadband", "mobile", "power", "recharge", "gas", "water", "insurance"];

  for (const [merchant, vendorTransactions] of Object.entries(grouped)) {
    if (vendorTransactions.length < 2) continue;

    // Sort by date ascending
    vendorTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 1. Calculate Gaps & Filter Anomalies (Ignore failed transaction retry loops < 3 days)
    const rawGaps = [];
    for (let i = 1; i < vendorTransactions.length; i++) {
      const prev = new Date(vendorTransactions[i - 1].date);
      const curr = new Date(vendorTransactions[i].date);
      const days = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      rawGaps.push(days);
    }

    // Filter retry anomalies
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

    // 4. Calculate Average Amount
    const avgAmount = vendorTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0) / vendorTransactions.length;

    // 5. Utility vs SaaS Amount Variance Check
    const merchantLower = (vendorTransactions[0].merchant || "").toLowerCase();
    const isUtility = utilityKeywords.some(keyword => merchantLower.includes(keyword)) || 
                      (vendorTransactions[0].category === "bills" || vendorTransactions[0].category === "rent");

    const varianceLimit = isUtility ? 0.45 : 0.15; // 45% variance limit for utilities, 15% for flat-rate SaaS

    const similarAmounts = vendorTransactions.every(transaction => {
      const diff = Math.abs(Number(transaction.amount) - avgAmount);
      return diff <= (avgAmount * varianceLimit);
    });

    if (!similarAmounts) continue;

    // 6. Detailed Confidence Scoring
    let confidence = 50;

    // Length weights
    if (vendorTransactions.length === 3) confidence += 15;
    else if (vendorTransactions.length === 4) confidence += 20;
    else if (vendorTransactions.length >= 5) confidence += 30;

    // Gap consistency weight
    const gapDeviations = filteredGaps.map(gap => Math.abs(gap - medianGap));
    const avgGapDeviation = gapDeviations.reduce((a, b) => a + b, 0) / gapDeviations.length;
    if (avgGapDeviation <= 1.5) confidence += 10;
    else if (avgGapDeviation <= 3) confidence += 5;

    // SaaS amount stability bonus
    if (!isUtility) {
      const amountDeviations = vendorTransactions.map(t => Math.abs(Number(t.amount) - avgAmount));
      const avgAmtDeviation = amountDeviations.reduce((a, b) => a + b, 0) / amountDeviations.length;
      if (avgAmtDeviation <= avgAmount * 0.05) confidence += 10;
    }

    confidence = Math.min(Math.max(confidence, 40), 99);

    subscriptions.push({
      merchant,
      displayName: vendorTransactions[0].merchant,
      category: vendorTransactions[0].category,
      recurringCount: vendorTransactions.length,
      averageAmount: avgAmount,
      lastCharge: vendorTransactions.at(-1).date,
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
