import test from "node:test";
import assert from "node:assert";
import {
  normalizeTransactions,
  isSpendTransaction,
  getBrandName,
  detectRecurringSubscriptions,
  getMonthKey
} from "../helpers.js";

test("getMonthKey - extracts YYYY-MM correctly", () => {
  assert.strictEqual(getMonthKey("2026-05-28"), "2026-05");
  assert.strictEqual(getMonthKey("2026/01/15"), "2026-01");
  assert.strictEqual(getMonthKey(""), "Unknown");
  assert.strictEqual(getMonthKey(null), "Unknown");
  assert.strictEqual(getMonthKey("invalid-date"), "Unknown");
});

test("getBrandName - normalizes subscription brands", () => {
  assert.strictEqual(getBrandName("NETFLIX COM SGP"), "netflix");
  assert.strictEqual(getBrandName("SPOTIFY SWEDEN"), "spotify");
  assert.strictEqual(getBrandName("YOUTUBE PREMIUM"), "youtube");
  assert.strictEqual(getBrandName("AMAZON PRIME SELLER"), "amazon prime");
  assert.strictEqual(getBrandName("My Custom Vendor"), "My Custom Vendor");
});

test("isSpendTransaction - identifies debit spend transactions correctly", () => {
  const debitTx = { type: "debit", merchant: "Zomato Bangalore" };
  const creditTx = { type: "credit", merchant: "Zomato Bangalore" };
  const excludedDebitTx = { type: "debit", merchant: "CRED CARD PAYMENT THANK YOU" };
  const refundTx = { type: "debit", merchant: "REFUND Swiggy" };

  assert.strictEqual(isSpendTransaction(debitTx), true);
  assert.strictEqual(isSpendTransaction(creditTx), false);
  assert.strictEqual(isSpendTransaction(excludedDebitTx), false);
  assert.strictEqual(isSpendTransaction(refundTx), false);
});

test("normalizeTransactions - transforms raw DB fields to camelCase applications format", () => {
  const rawRows = [
    {
      date: "2026-05-28",
      transaction_hash: "tx_hash_123",
      merchant: "Swiggy Star",
      normalized_merchant: "swiggy",
      source_bank: "HDFC Savings",
      statement_date: "2026-05-31",
      linked_transaction_hash: null,
      amount: 450,
      type: "debit"
    }
  ];

  const normalized = normalizeTransactions(rawRows);
  assert.strictEqual(normalized.length, 1);
  assert.strictEqual(normalized[0].transactionHash, "tx_hash_123");
  assert.strictEqual(normalized[0].description, "Swiggy Star");
  assert.strictEqual(normalized[0].normalizedMerchant, "swiggy");
  assert.strictEqual(normalized[0].sourceBank, "HDFC Savings");
  assert.strictEqual(normalized[0].statementDate, "2026-05-31");
  assert.strictEqual(normalized[0].linkedTransactionHash, null);
  assert.strictEqual(normalized[0].dateString, "28/05/2026");
});

test("detectRecurringSubscriptions - extracts recurring subscriptions with matching frequencies", () => {
  const txs = [
    { date: "2026-01-01", type: "debit", normalized_merchant: "netflix", merchant: "Netflix", amount: 199, category: "bills" },
    { date: "2026-02-01", type: "debit", normalized_merchant: "netflix", merchant: "Netflix", amount: 199, category: "bills" },
    { date: "2026-03-03", type: "debit", normalized_merchant: "netflix", merchant: "Netflix", amount: 199, category: "bills" },
    
    { date: "2026-01-15", type: "debit", normalized_merchant: "spotify", merchant: "Spotify", amount: 119, category: "bills" },
    { date: "2026-02-14", type: "debit", normalized_merchant: "spotify", merchant: "Spotify", amount: 119, category: "bills" }
  ];

  const subs = detectRecurringSubscriptions(txs);
  assert.strictEqual(subs.length, 2);

  const netflixSub = subs.find(s => s.merchant === "netflix");
  assert.ok(netflixSub);
  assert.strictEqual(netflixSub.displayName, "Netflix");
  assert.strictEqual(netflixSub.frequency, "monthly");
  assert.strictEqual(netflixSub.recurringCount, 3);
  assert.strictEqual(netflixSub.averageAmount, 199);

  const spotifySub = subs.find(s => s.merchant === "spotify");
  assert.ok(spotifySub);
  assert.strictEqual(spotifySub.displayName, "Spotify");
  assert.strictEqual(spotifySub.frequency, "monthly");
  assert.strictEqual(spotifySub.recurringCount, 2);
  assert.strictEqual(spotifySub.averageAmount, 119);
});
